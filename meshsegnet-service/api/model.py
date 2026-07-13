"""
MeshSegNet neural network architecture.

Reference:
  Lian et al. "MeshSegNet: Deep Multi-Scale Mesh Feature Learning for
  Automated Labeling of Raw Dental Surface from 3D Intraoral Scanners"
  IEEE Transactions on Medical Imaging, 2021.
  https://doi.org/10.1109/TMI.2020.3025508

Architecture summary:
  Input: per-face feature matrix  [N_faces × 15]
    - centroid_normalized (3)
    - normal (3)
    - area (1)
    - relative_position (3)
    - neighbor_displacement (3)
    - normal_consistency (1)
    - mean_edge_length (1)

  Local graph convolution layers (STLocalGCN):
    gcn1: 15  → 64   (K=6 neighbours)
    gcn2: 64  → 128
    gcn3: 128 → 256
    gcn4: 256 → 512

  Global feature branch:
    pool(gcn4 output)  [512]
    → linear 512→1024 → BN → ReLU
    → linear 1024→256 → BN → ReLU   [256]
    → repeat for each face            [N_faces × 256]

  Concatenation + classifier:
    cat(gcn1, gcn2, gcn3, gcn4, global): [N_faces × (64+128+256+512+256)] = [N_faces × 1216]
    → linear 1216→512 → BN → ReLU → Dropout(0.3)
    → linear 512→256  → BN → ReLU → Dropout(0.3)
    → linear 256→17            (17 classes: 0=gingiva, 1–16→FDI via jaw mapping)
    → log_softmax

License: MIT (original MeshSegNet authors, adapted for this service).
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class STLocalGCN(nn.Module):
    """
    Spatial Transformer Local Graph Convolution.

    Gathers K nearest-neighbour features, computes edge features as
    [neighbour − centre ‖ centre] (dimension 2×in_channels), then
    max-pools over neighbours to produce an in_channels → out_channels
    per-face embedding.
    """

    def __init__(self, in_channels: int, out_channels: int, K: int = 6) -> None:
        super().__init__()
        self.K = K
        # Edge MLP: takes concatenation of [neighbor - center, center]
        self.edge_mlp = nn.Sequential(
            nn.Linear(2 * in_channels, out_channels, bias=False),
            nn.BatchNorm1d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """
        x:   [N, C_in]
        adj: [N, K]  — K nearest-neighbour indices for each face

        Returns: [N, C_out]
        """
        N, C = x.shape
        # Gather neighbour features: [N, K, C]
        neighbours = x[adj]  # adj: [N, K] → [N, K, C]
        # Center repeated for subtraction: [N, K, C]
        center = x.unsqueeze(1).expand(-1, self.K, -1)
        # Edge feature: displacement + center → [N, K, 2C]
        edge_feat = torch.cat([neighbours - center, center], dim=-1)
        # Apply MLP per edge: reshape [N*K, 2C] → MLP → [N*K, C_out] → [N, K, C_out]
        edge_feat = edge_feat.view(N * self.K, 2 * C)
        edge_feat = self.edge_mlp(edge_feat)
        edge_feat = edge_feat.view(N, self.K, -1)
        # Max-pool over K neighbours: [N, C_out]
        out, _ = edge_feat.max(dim=1)
        return out


class MeshSegNet(nn.Module):
    """
    Multi-scale mesh segmentation network.

    num_classes = 17 (0 = gingiva; 1–16 mapped to FDI via jaw-specific table).
    """

    NUM_CLASSES = 17

    def __init__(self, num_features: int = 15, K: int = 6, dropout: float = 0.3) -> None:
        super().__init__()

        self.gcn1 = STLocalGCN(num_features, 64, K)
        self.gcn2 = STLocalGCN(64, 128, K)
        self.gcn3 = STLocalGCN(128, 256, K)
        self.gcn4 = STLocalGCN(256, 512, K)

        # Global feature branch (after global max-pool of gcn4 output)
        self.global_fc = nn.Sequential(
            nn.Linear(512, 1024, bias=False),
            nn.BatchNorm1d(1024),
            nn.ReLU(inplace=True),
            nn.Linear(1024, 256, bias=False),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
        )

        # 64 + 128 + 256 + 512 + 256 = 1216
        concat_dim = 64 + 128 + 256 + 512 + 256

        self.classifier = nn.Sequential(
            nn.Linear(concat_dim, 512, bias=False),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(512, 256, bias=False),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(256, self.NUM_CLASSES),
        )

    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """
        x:   [N, 15]  per-face features
        adj: [N, K]   K-neighbour adjacency indices

        Returns: [N, 17] log-softmax class scores
        """
        f1 = self.gcn1(x, adj)    # [N, 64]
        f2 = self.gcn2(f1, adj)   # [N, 128]
        f3 = self.gcn3(f2, adj)   # [N, 256]
        f4 = self.gcn4(f3, adj)   # [N, 512]

        # Global feature: max-pool over all faces → [512] → FC → [256] → repeat → [N, 256]
        g = f4.max(dim=0, keepdim=True).values  # [1, 512]
        g = self.global_fc(g)                   # [1, 256]
        g = g.expand(x.shape[0], -1)            # [N, 256]

        # Concat multi-scale + global: [N, 1216]
        cat = torch.cat([f1, f2, f3, f4, g], dim=1)

        return F.log_softmax(self.classifier(cat), dim=1)


# FDI mapping tables (MeshSegNet raw class index → FDI tooth number)
# Class 0 = gingiva (background) — kept as 0.
# Upper jaw: classes 1–8 = teeth 18–11 (right side), 9–16 = teeth 21–28 (left side)
# Lower jaw: classes 1–8 = teeth 48–41 (right side), 9–16 = teeth 31–38 (left side)

_UPPER_FDI_MAP: dict[int, int] = {
    1: 18, 2: 17, 3: 16, 4: 15, 5: 14, 6: 13, 7: 12, 8: 11,
    9: 21, 10: 22, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
}

_LOWER_FDI_MAP: dict[int, int] = {
    1: 48, 2: 47, 3: 46, 4: 45, 5: 44, 6: 43, 7: 42, 8: 41,
    9: 31, 10: 32, 11: 33, 12: 34, 13: 35, 14: 36, 15: 37, 16: 38,
}


def class_labels_to_fdi(raw_labels: list[int], jaw: str) -> list[int]:
    """
    Convert raw MeshSegNet class indices to FDI tooth numbers.

    Args:
        raw_labels: list of integers in range 0–16
        jaw: "upper" | "lower"

    Returns:
        list of FDI codes (0 = gingiva/background, kept as 0)
    """
    mapping = _UPPER_FDI_MAP if jaw == "upper" else _LOWER_FDI_MAP
    return [mapping.get(lbl, 0) for lbl in raw_labels]
