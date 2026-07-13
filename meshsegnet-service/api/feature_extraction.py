"""
Per-face feature extraction for MeshSegNet.

Computes the 15-dimensional feature vector for each mesh face:
  [0:3]   centroid_normalized   — face centroid normalized to [-1, 1]
  [3:6]   normal                — unit face normal
  [6]     area                  — face area (normalized by median)
  [7:10]  relative_position     — centroid relative to mesh centroid
  [10:13] neighbor_displacement — mean displacement to K-nearest neighbours
  [13]    normal_consistency    — mean dot product with K-nearest neighbour normals
  [14]    mean_edge_length      — mean edge length of the face (normalized)

Returns the feature matrix [N_faces × 15] and the KNN adjacency [N_faces × K].
"""
from __future__ import annotations

import numpy as np


def _face_centroids(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Return [N_faces, 3] face centroids."""
    return vertices[faces].mean(axis=1)


def _face_normals(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Return [N_faces, 3] unit face normals."""
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    n = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(n, axis=1, keepdims=True)
    norms = np.where(norms < 1e-8, 1.0, norms)
    return n / norms


def _face_areas(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Return [N_faces] face areas."""
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    n = np.cross(v1 - v0, v2 - v0)
    return 0.5 * np.linalg.norm(n, axis=1)


def _knn_adjacency(centroids: np.ndarray, K: int) -> np.ndarray:
    """
    Build KNN adjacency [N, K] by brute-force Euclidean distance.

    For typical dental meshes (5K–200K faces) this is fast enough.
    K neighbours are chosen excluding the face itself; if fewer than K
    faces exist, duplicates pad the result.
    """
    N = centroids.shape[0]
    K = min(K, N - 1)

    # Pairwise squared distances: [N, N]
    diff = centroids[:, np.newaxis, :] - centroids[np.newaxis, :, :]  # [N, N, 3]
    dist2 = (diff ** 2).sum(axis=-1)                                   # [N, N]
    np.fill_diagonal(dist2, np.inf)

    # K smallest indices
    idx = np.argpartition(dist2, K, axis=1)[:, :K]  # [N, K]
    return idx.astype(np.int64)


def extract_features(
    vertices: np.ndarray,
    faces: np.ndarray,
    K: int = 6,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute per-face feature matrix and KNN adjacency for MeshSegNet.

    Args:
        vertices: [V, 3] float32 vertex positions
        faces:    [F, 3] int32 triangle vertex indices
        K:        number of nearest neighbours for local graph

    Returns:
        features: [F, 15] float32
        adj:      [F, K]  int64 — indices of K nearest face centroids
    """
    vertices = np.asarray(vertices, dtype=np.float32)
    faces = np.asarray(faces, dtype=np.int64)

    centroids = _face_centroids(vertices, faces)        # [F, 3]
    normals = _face_normals(vertices, faces)            # [F, 3]
    areas = _face_areas(vertices, faces)                # [F]

    adj = _knn_adjacency(centroids, K)                  # [F, K]

    # 1. Centroid normalized to [-1, 1]
    c_min = centroids.min(axis=0)
    c_max = centroids.max(axis=0)
    span = np.where((c_max - c_min) < 1e-8, 1.0, c_max - c_min)
    centroid_norm = 2.0 * (centroids - c_min) / span - 1.0  # [F, 3]

    # 2. Normal (already unit)
    normal = normals  # [F, 3]

    # 3. Area normalized by median
    median_area = np.median(areas) if areas.size > 0 else 1.0
    if median_area < 1e-12:
        median_area = 1.0
    area_norm = (areas / median_area).reshape(-1, 1)  # [F, 1]

    # 4. Relative position (centroid minus mesh centroid)
    mesh_centroid = centroids.mean(axis=0)
    rel_pos = centroids - mesh_centroid  # [F, 3]
    rel_span = np.linalg.norm(rel_pos, axis=1).max()
    if rel_span < 1e-8:
        rel_span = 1.0
    rel_pos = rel_pos / rel_span  # [F, 3]

    # 5. Neighbour displacement (mean of centroid[adj] - centroid)
    # adj: [F, K]; centroids: [F, 3]
    neighbour_centroids = centroids[adj]                    # [F, K, 3]
    displacements = neighbour_centroids - centroids[:, None, :]  # [F, K, 3]
    mean_disp = displacements.mean(axis=1)                  # [F, 3]
    disp_scale = np.linalg.norm(mean_disp, axis=1).max()
    if disp_scale < 1e-8:
        disp_scale = 1.0
    mean_disp = mean_disp / disp_scale  # [F, 3]

    # 6. Normal consistency (mean dot product with K-nearest neighbour normals)
    neighbour_normals = normals[adj]                        # [F, K, 3]
    dot = (normals[:, None, :] * neighbour_normals).sum(axis=-1)  # [F, K]
    normal_consistency = dot.mean(axis=1).reshape(-1, 1)          # [F, 1]

    # 7. Mean edge length of each face (normalized by overall median)
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    e0 = np.linalg.norm(v1 - v0, axis=1)
    e1 = np.linalg.norm(v2 - v1, axis=1)
    e2 = np.linalg.norm(v0 - v2, axis=1)
    mean_edge = ((e0 + e1 + e2) / 3.0).reshape(-1, 1)  # [F, 1]
    edge_median = np.median(mean_edge) if mean_edge.size > 0 else 1.0
    if edge_median < 1e-12:
        edge_median = 1.0
    mean_edge = mean_edge / edge_median  # [F, 1]

    # Concatenate all features: [F, 3+3+1+3+3+1+1] = [F, 15]
    features = np.concatenate(
        [centroid_norm, normal, area_norm, rel_pos, mean_disp, normal_consistency, mean_edge],
        axis=1,
    ).astype(np.float32)

    return features, adj
