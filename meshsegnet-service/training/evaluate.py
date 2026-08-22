"""
Evaluate a trained MeshSegNet checkpoint on a preprocessed cache.

Reports per-class IoU and Dice (raw class index + FDI code for both jaws),
mean IoU/Dice over classes present in the ground truth, and overall face
accuracy. Optionally writes the numbers to a JSON report.

    python evaluate.py --checkpoint runs/exp1/best.pt --cache-dir ./cache \
        --split-file testing_ids.txt --report eval_report.json

Without --split-file every .npz in --cache-dir is evaluated (use a cache
directory that contains only held-out scans, or pass the same --split-file
you trained with so only the val split is scored).
"""
from __future__ import annotations

import argparse
import glob
import json
import os

import numpy as np
import torch

from common import (
    K_NEIGHBOURS,
    NUM_CLASSES,
    NUM_FEATURES,
    MeshSegNet,
    _LOWER_FDI_MAP,
    _UPPER_FDI_MAP,
)
from dataset import CachedMeshDataset, split_paths


def load_model(checkpoint_path: str, device: torch.device) -> MeshSegNet:
    ckpt = torch.load(checkpoint_path, map_location=device)
    state = ckpt.get("model_state_dict", ckpt)  # training ckpt or bare state dict
    model = MeshSegNet(num_features=NUM_FEATURES, K=K_NEIGHBOURS)
    model.load_state_dict(state, strict=True)
    model.to(device).eval()
    return model


@torch.no_grad()
def confusion(model: MeshSegNet, dataset: CachedMeshDataset, device: torch.device) -> np.ndarray:
    cm = np.zeros((NUM_CLASSES, NUM_CLASSES), dtype=np.int64)
    for i in range(len(dataset)):
        feats, adj, labels = dataset[i]
        x = torch.from_numpy(feats).to(device)
        a = torch.from_numpy(adj).to(device)
        pred = model(x, a).argmax(dim=1).cpu().numpy()
        np.add.at(cm, (labels, pred), 1)
    return cm


def per_class_metrics(cm: np.ndarray) -> dict:
    tp = np.diag(cm).astype(np.float64)
    fp = cm.sum(axis=0) - tp
    fn = cm.sum(axis=1) - tp
    union = tp + fp + fn
    present = cm.sum(axis=1) > 0  # class appears in ground truth

    iou = np.where(union > 0, tp / np.maximum(union, 1), 0.0)
    dice = np.where((2 * tp + fp + fn) > 0, 2 * tp / np.maximum(2 * tp + fp + fn, 1), 0.0)

    classes = []
    for c in range(NUM_CLASSES):
        classes.append({
            "class": c,
            "fdi_upper": 0 if c == 0 else _UPPER_FDI_MAP[c],
            "fdi_lower": 0 if c == 0 else _LOWER_FDI_MAP[c],
            "gt_faces": int(cm[c].sum()),
            "present_in_gt": bool(present[c]),
            "iou": round(float(iou[c]), 4),
            "dice": round(float(dice[c]), 4),
        })

    return {
        "overall_accuracy": round(float(tp.sum() / max(cm.sum(), 1)), 4),
        "mean_iou": round(float(iou[present].mean()) if present.any() else 0.0, 4),
        "mean_dice": round(float(dice[present].mean()) if present.any() else 0.0, 4),
        "teeth_mean_iou": round(
            float(iou[present & (np.arange(NUM_CLASSES) > 0)].mean())
            if (present & (np.arange(NUM_CLASSES) > 0)).any() else 0.0, 4),
        "classes": classes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate MeshSegNet checkpoint")
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--cache-dir", required=True)
    parser.add_argument("--split-file", help="restrict to the listed sample ids (val/test split)")
    parser.add_argument("--report", help="write metrics JSON here")
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    npz_paths = sorted(glob.glob(os.path.join(args.cache_dir, "*.npz")))
    if args.split_file:
        _, npz_paths = split_paths(npz_paths, 0.0, 0, args.split_file)
    if not npz_paths:
        print("ERROR: no samples to evaluate")
        return 1

    device = torch.device(args.device)
    model = load_model(args.checkpoint, device)
    dataset = CachedMeshDataset(npz_paths)
    print(f"[eval] {len(dataset)} meshes, checkpoint {args.checkpoint}, device {device}")

    cm = confusion(model, dataset, device)
    metrics = per_class_metrics(cm)
    metrics["checkpoint"] = os.path.abspath(args.checkpoint)
    metrics["num_meshes"] = len(dataset)

    print(f"\noverall accuracy : {metrics['overall_accuracy']}")
    print(f"mean IoU         : {metrics['mean_iou']}")
    print(f"mean Dice        : {metrics['mean_dice']}")
    print(f"teeth-only mIoU  : {metrics['teeth_mean_iou']}  (excludes gingiva class 0)\n")
    print(f"{'cls':>3} {'FDI up':>6} {'FDI lo':>6} {'gt faces':>9} {'IoU':>7} {'Dice':>7}")
    for c in metrics["classes"]:
        if not c["present_in_gt"]:
            continue
        print(f"{c['class']:>3} {c['fdi_upper']:>6} {c['fdi_lower']:>6} "
              f"{c['gt_faces']:>9} {c['iou']:>7.4f} {c['dice']:>7.4f}")

    if args.report:
        with open(args.report, "w", encoding="utf-8") as fh:
            json.dump(metrics, fh, indent=2)
        print(f"\n[eval] report written to {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
