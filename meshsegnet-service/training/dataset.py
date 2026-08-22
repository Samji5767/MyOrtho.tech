"""
Teeth3DS(+) dataset preprocessing and PyTorch dataset for MeshSegNet training.

Raw layout expected (as distributed by the 3DTeethSeg'22 challenge /
Teeth3DS+ release): pairs of files per scan,

    <case>_<jaw>.obj    — intraoral surface mesh
    <case>_<jaw>.json   — {"jaw": "upper"|"lower",
                           "labels": [per-vertex FDI code, 0 = gingiva],
                           "instances": [...]}

The files may live in any nested directory structure; they are discovered
recursively and paired by basename.

Preprocessing (`python dataset.py --raw-dir RAW --out-dir CACHE`):
  1. load mesh (trimesh) and per-vertex FDI labels
  2. per-face label by majority vote over the face's 3 vertices
  3. FDI -> raw class index 0-16 via the jaw-specific inverse map
     (single source of truth: meshsegnet-service/api/model.py)
  4. randomly subsample faces to --sample-faces (training-memory bound;
     the brute-force KNN in feature extraction is O(F^2))
  5. run the service's own extract_features() on the subsampled mesh
  6. save one .npz per scan: features [F,15], adj [F,K], labels [F]

Training then reads only the .npz cache (fast, no trimesh needed).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass

import numpy as np

from common import K_NEIGHBOURS, NUM_CLASSES, extract_features, fdi_to_class


@dataclass
class RawSample:
    sample_id: str  # e.g. "0EJBIPTC_lower"
    jaw: str        # "upper" | "lower"
    obj_path: str
    json_path: str


def discover_raw_samples(raw_dir: str) -> list[RawSample]:
    """Recursively find (obj, json) pairs. Jaw is read from the JSON when
    present, else inferred from the filename."""
    obj_paths: dict[str, str] = {}
    json_paths: dict[str, str] = {}
    for root, _dirs, files in os.walk(raw_dir):
        for name in files:
            stem, ext = os.path.splitext(name)
            path = os.path.join(root, name)
            if ext.lower() == ".obj":
                obj_paths[stem] = path
            elif ext.lower() == ".json":
                json_paths[stem] = path

    samples: list[RawSample] = []
    for stem, obj_path in sorted(obj_paths.items()):
        json_path = json_paths.get(stem)
        if json_path is None:
            continue  # unannotated mesh — unusable for supervised training
        jaw = "lower" if "lower" in stem.lower() else "upper"
        samples.append(RawSample(sample_id=stem, jaw=jaw, obj_path=obj_path, json_path=json_path))
    return samples


def face_labels_from_vertex_labels(faces: np.ndarray, vertex_labels: np.ndarray) -> np.ndarray:
    """
    Majority vote of the 3 vertex labels per face.
    Tie-break: any non-gingiva label wins over gingiva; among teeth, the
    smallest label wins (deterministic).
    """
    tri = vertex_labels[faces]  # [F, 3]
    out = np.zeros(faces.shape[0], dtype=np.int64)
    # Fast path: all three agree
    agree = (tri[:, 0] == tri[:, 1]) & (tri[:, 1] == tri[:, 2])
    out[agree] = tri[agree, 0]
    # Slow path: vote
    for i in np.nonzero(~agree)[0]:
        vals, counts = np.unique(tri[i], return_counts=True)
        best = counts.max()
        winners = vals[counts == best]
        if len(winners) > 1:
            non_bg = winners[winners != 0]
            out[i] = non_bg.min() if non_bg.size else 0
        else:
            out[i] = winners[0]
    return out


def preprocess_sample(
    sample: RawSample,
    out_dir: str,
    sample_faces: int,
    seed: int,
    k: int = K_NEIGHBOURS,
) -> str | None:
    """Convert one raw scan to a cached .npz. Returns the output path, or
    None if the sample is unusable (bad labels, degenerate mesh)."""
    import trimesh

    mesh = trimesh.load(sample.obj_path, force="mesh", process=False)
    vertices = np.asarray(mesh.vertices, dtype=np.float32)
    faces = np.asarray(mesh.faces, dtype=np.int64)

    with open(sample.json_path, "r", encoding="utf-8") as fh:
        ann = json.load(fh)
    jaw = str(ann.get("jaw", sample.jaw)).lower()
    if jaw not in ("upper", "lower"):
        jaw = sample.jaw
    vertex_fdi = np.asarray(ann["labels"], dtype=np.int64)

    if vertex_fdi.shape[0] != vertices.shape[0]:
        print(
            f"[skip] {sample.sample_id}: {vertex_fdi.shape[0]} labels vs "
            f"{vertices.shape[0]} vertices (annotation/mesh mismatch)",
            file=sys.stderr,
        )
        return None
    if faces.shape[0] < 100:
        print(f"[skip] {sample.sample_id}: only {faces.shape[0]} faces", file=sys.stderr)
        return None

    vertex_classes = np.asarray(fdi_to_class(vertex_fdi, jaw), dtype=np.int64)
    face_classes = face_labels_from_vertex_labels(faces, vertex_classes)

    # Subsample faces (uniform, without replacement) to bound KNN memory.
    n_faces = faces.shape[0]
    if sample_faces and n_faces > sample_faces:
        rng = np.random.default_rng(seed)
        keep = rng.choice(n_faces, size=sample_faces, replace=False)
        keep.sort()
        faces = faces[keep]
        face_classes = face_classes[keep]

    features, adj = extract_features(vertices, faces, K=k)

    if not np.isfinite(features).all():
        print(f"[skip] {sample.sample_id}: non-finite features", file=sys.stderr)
        return None

    out_path = os.path.join(out_dir, f"{sample.sample_id}.npz")
    np.savez_compressed(
        out_path,
        features=features.astype(np.float32),
        adj=adj.astype(np.int64),
        labels=face_classes.astype(np.int64),
        jaw=jaw,
        sample_id=sample.sample_id,
    )
    return out_path


class CachedMeshDataset:
    """
    Minimal dataset over preprocessed .npz files (no torch DataLoader
    required — MeshSegNet consumes one whole mesh per forward pass because
    of its global-pooling branch, so 'batch size' is one mesh).
    """

    def __init__(self, npz_paths: list[str]):
        self.paths = list(npz_paths)

    def __len__(self) -> int:
        return len(self.paths)

    def __getitem__(self, idx: int):
        data = np.load(self.paths[idx], allow_pickle=False)
        return (
            data["features"].astype(np.float32),
            data["adj"].astype(np.int64),
            data["labels"].astype(np.int64),
        )

    def class_weights(self) -> np.ndarray:
        """Inverse-frequency class weights over the whole set (gingiva
        dominates dental scans; unweighted CE collapses to background)."""
        counts = np.zeros(NUM_CLASSES, dtype=np.float64)
        for path in self.paths:
            labels = np.load(path)["labels"]
            binc = np.bincount(labels, minlength=NUM_CLASSES)
            counts += binc[:NUM_CLASSES]
        counts = np.maximum(counts, 1.0)
        weights = counts.sum() / (NUM_CLASSES * counts)
        return (weights / weights.mean()).astype(np.float32)


def split_paths(
    npz_paths: list[str],
    val_fraction: float,
    seed: int,
    split_file: str | None = None,
) -> tuple[list[str], list[str]]:
    """
    Case-level train/val split.

    With --split-file (one sample_id per line, e.g. the official Teeth3DS
    testing_upper.txt/testing_lower.txt lists), listed ids become the val
    set. Otherwise splits randomly by *case id* (the part of the filename
    before the jaw suffix) so upper/lower scans of the same patient never
    straddle the split.
    """
    if split_file:
        with open(split_file, "r", encoding="utf-8") as fh:
            val_ids = {line.strip().replace(".obj", "") for line in fh if line.strip()}
        train = [p for p in npz_paths if _stem(p) not in val_ids]
        val = [p for p in npz_paths if _stem(p) in val_ids]
        return train, val

    case_ids = sorted({_case_id(p) for p in npz_paths})
    rng = np.random.default_rng(seed)
    rng.shuffle(case_ids)
    n_val = max(1, int(round(len(case_ids) * val_fraction)))
    val_cases = set(case_ids[:n_val])
    train = [p for p in npz_paths if _case_id(p) not in val_cases]
    val = [p for p in npz_paths if _case_id(p) in val_cases]
    return train, val


def _stem(path: str) -> str:
    return os.path.splitext(os.path.basename(path))[0]


def _case_id(path: str) -> str:
    stem = _stem(path)
    for suffix in ("_upper", "_lower"):
        if stem.endswith(suffix):
            return stem[: -len(suffix)]
    return stem


def main() -> int:
    parser = argparse.ArgumentParser(description="Preprocess Teeth3DS(+) scans into training cache")
    parser.add_argument("--raw-dir", required=True, help="directory containing .obj/.json pairs (searched recursively)")
    parser.add_argument("--out-dir", required=True, help="output directory for .npz cache")
    parser.add_argument("--sample-faces", type=int, default=10000,
                        help="max faces per mesh after subsampling (0 = keep all; KNN memory is O(F^2))")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--limit", type=int, default=0, help="process at most N samples (0 = all)")
    args = parser.parse_args()

    samples = discover_raw_samples(args.raw_dir)
    if not samples:
        print(f"ERROR: no (.obj, .json) pairs found under {args.raw_dir}", file=sys.stderr)
        return 1
    if args.limit:
        samples = samples[: args.limit]

    os.makedirs(args.out_dir, exist_ok=True)
    print(f"[preprocess] {len(samples)} annotated scans -> {args.out_dir}")

    try:
        from tqdm import tqdm
        iterator = tqdm(samples, unit="scan")
    except ImportError:
        iterator = samples

    ok = 0
    for i, sample in enumerate(iterator):
        out_path = os.path.join(args.out_dir, f"{sample.sample_id}.npz")
        if os.path.exists(out_path):
            ok += 1
            continue  # resumable
        if preprocess_sample(sample, args.out_dir, args.sample_faces, seed=args.seed + i):
            ok += 1

    print(f"[preprocess] done: {ok}/{len(samples)} scans cached")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
