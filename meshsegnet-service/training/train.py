"""
MeshSegNet training loop.

Consumes the .npz cache produced by dataset.py and trains the exact model
class the inference service uses (meshsegnet-service/api/model.py), so a
checkpoint saved here loads into the service with no conversion.

One mesh per optimization step: the architecture global-max-pools over all
faces of a mesh, so meshes cannot be concatenated into a batch; gradient
accumulation (--accum) emulates larger batches.

Loss = weighted NLL (model outputs log-softmax) + soft multi-class Dice,
the combination used by the original MeshSegNet paper family to counter
the heavy gingiva/tooth class imbalance.

Typical run on a rented GPU box (see README.md):

    python train.py --cache-dir ./cache --out-dir ./runs/exp1 \
        --epochs 60 --lr 1e-3 --device cuda

Smoke test (CPU, synthetic data — verifies the pipeline end to end but
produces meaningless weights):

    python train.py --smoke --out-dir /tmp/smoke
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import time

import numpy as np
import torch
import torch.nn.functional as F

from common import K_NEIGHBOURS, NUM_CLASSES, NUM_FEATURES, MeshSegNet
from dataset import CachedMeshDataset, split_paths


def dice_loss(log_probs: torch.Tensor, labels: torch.Tensor, eps: float = 1e-6) -> torch.Tensor:
    """Soft multi-class Dice over classes present in the ground truth."""
    probs = log_probs.exp()                                  # [N, C]
    one_hot = F.one_hot(labels, NUM_CLASSES).to(probs.dtype)  # [N, C]
    present = one_hot.sum(dim=0) > 0                          # [C]
    intersection = (probs * one_hot).sum(dim=0)               # [C]
    union = probs.sum(dim=0) + one_hot.sum(dim=0)             # [C]
    dice = (2.0 * intersection + eps) / (union + eps)         # [C]
    return 1.0 - dice[present].mean()


@torch.no_grad()
def evaluate_miou(model: MeshSegNet, dataset: CachedMeshDataset, device: torch.device) -> tuple[float, float]:
    """Returns (mean IoU over classes present in GT, overall face accuracy)."""
    model.eval()
    intersection = np.zeros(NUM_CLASSES, dtype=np.int64)
    union = np.zeros(NUM_CLASSES, dtype=np.int64)
    seen = np.zeros(NUM_CLASSES, dtype=bool)
    correct = 0
    total = 0
    for i in range(len(dataset)):
        feats, adj, labels = dataset[i]
        x = torch.from_numpy(feats).to(device)
        a = torch.from_numpy(adj).to(device)
        pred = model(x, a).argmax(dim=1).cpu().numpy()
        correct += int((pred == labels).sum())
        total += labels.shape[0]
        for c in np.union1d(np.unique(labels), np.unique(pred)):
            p = pred == c
            g = labels == c
            intersection[c] += int((p & g).sum())
            union[c] += int((p | g).sum())
            if g.any():
                seen[c] = True
    ious = intersection[seen & (union > 0)] / np.maximum(union[seen & (union > 0)], 1)
    miou = float(ious.mean()) if ious.size else 0.0
    acc = correct / max(total, 1)
    return miou, acc


def make_smoke_cache(cache_dir: str, n_samples: int = 4, n_faces: int = 400, seed: int = 0) -> None:
    """Synthetic meshes for a CPU pipeline check. NOT dental data — the
    resulting weights are meaningless and must never be deployed."""
    from common import extract_features

    rng = np.random.default_rng(seed)
    os.makedirs(cache_dir, exist_ok=True)
    for s in range(n_samples):
        n_vertices = n_faces + 10
        vertices = rng.normal(size=(n_vertices, 3)).astype(np.float32) * 10.0
        faces = rng.integers(0, n_vertices, size=(n_faces, 3)).astype(np.int64)
        # avoid degenerate faces with repeated indices
        faces[:, 1] = (faces[:, 0] + 1) % n_vertices
        faces[:, 2] = (faces[:, 0] + 2) % n_vertices
        features, adj = extract_features(vertices, faces, K=K_NEIGHBOURS)
        labels = rng.integers(0, NUM_CLASSES, size=n_faces).astype(np.int64)
        jaw = "upper" if s % 2 == 0 else "lower"
        np.savez_compressed(
            os.path.join(cache_dir, f"SMOKE{s:02d}_{jaw}.npz"),
            features=features, adj=adj, labels=labels, jaw=jaw,
            sample_id=f"SMOKE{s:02d}_{jaw}",
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Train MeshSegNet on preprocessed Teeth3DS cache")
    parser.add_argument("--cache-dir", help=".npz cache from dataset.py")
    parser.add_argument("--out-dir", required=True, help="run directory (checkpoints, log)")
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--accum", type=int, default=4, help="gradient accumulation steps (effective batch)")
    parser.add_argument("--dice-weight", type=float, default=0.5, help="weight of Dice term vs NLL")
    parser.add_argument("--val-fraction", type=float, default=0.15)
    parser.add_argument("--split-file", help="official val-id list (one sample id per line)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--resume", help="checkpoint to resume from (last.pt)")
    parser.add_argument("--smoke", action="store_true",
                        help="synthetic-data pipeline check on CPU; weights are meaningless")
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    os.makedirs(args.out_dir, exist_ok=True)

    if args.smoke:
        args.cache_dir = os.path.join(args.out_dir, "smoke-cache")
        args.epochs = min(args.epochs, 2)
        args.device = "cpu"
        make_smoke_cache(args.cache_dir)
        print("[smoke] synthetic cache created — verifying pipeline only, weights are NOT usable")

    if not args.cache_dir:
        parser.error("--cache-dir is required (or use --smoke)")

    npz_paths = sorted(glob.glob(os.path.join(args.cache_dir, "*.npz")))
    if len(npz_paths) < 2:
        print(f"ERROR: need at least 2 cached samples in {args.cache_dir}, found {len(npz_paths)}")
        return 1

    train_paths, val_paths = split_paths(npz_paths, args.val_fraction, args.seed, args.split_file)
    if not train_paths or not val_paths:
        print(f"ERROR: bad split — {len(train_paths)} train / {len(val_paths)} val")
        return 1
    train_set = CachedMeshDataset(train_paths)
    val_set = CachedMeshDataset(val_paths)
    print(f"[train] {len(train_set)} train / {len(val_set)} val meshes on {args.device}")

    class_weights = torch.from_numpy(train_set.class_weights())
    device = torch.device(args.device)
    class_weights = class_weights.to(device)

    model = MeshSegNet(num_features=NUM_FEATURES, K=K_NEIGHBOURS).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    start_epoch = 0
    best_miou = -1.0
    if args.resume:
        ckpt = torch.load(args.resume, map_location=device)
        model.load_state_dict(ckpt["model_state_dict"])
        optimizer.load_state_dict(ckpt["optimizer_state_dict"])
        scheduler.load_state_dict(ckpt["scheduler_state_dict"])
        start_epoch = ckpt["epoch"] + 1
        best_miou = ckpt.get("best_miou", -1.0)
        print(f"[train] resumed from {args.resume} at epoch {start_epoch}")

    log_path = os.path.join(args.out_dir, "train_log.jsonl")
    order = np.arange(len(train_set))
    rng = np.random.default_rng(args.seed)

    for epoch in range(start_epoch, args.epochs):
        model.train()
        rng.shuffle(order)
        epoch_loss = 0.0
        t0 = time.time()
        optimizer.zero_grad()

        for step, idx in enumerate(order):
            feats, adj, labels = train_set[int(idx)]
            x = torch.from_numpy(feats).to(device)
            a = torch.from_numpy(adj).to(device)
            y = torch.from_numpy(labels).to(device)

            log_probs = model(x, a)
            loss = F.nll_loss(log_probs, y, weight=class_weights)
            if args.dice_weight > 0:
                loss = loss + args.dice_weight * dice_loss(log_probs, y)
            (loss / args.accum).backward()
            epoch_loss += float(loss.item())

            if (step + 1) % args.accum == 0 or step + 1 == len(order):
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
                optimizer.step()
                optimizer.zero_grad()

        scheduler.step()
        val_miou, val_acc = evaluate_miou(model, val_set, device)
        mean_loss = epoch_loss / len(order)
        elapsed = time.time() - t0
        print(
            f"[epoch {epoch + 1:3d}/{args.epochs}] loss={mean_loss:.4f} "
            f"val_mIoU={val_miou:.4f} val_acc={val_acc:.4f} lr={scheduler.get_last_lr()[0]:.2e} "
            f"({elapsed:.0f}s)"
        )
        with open(log_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({
                "epoch": epoch + 1, "loss": mean_loss, "val_miou": val_miou,
                "val_acc": val_acc, "lr": scheduler.get_last_lr()[0], "seconds": elapsed,
            }) + "\n")

        ckpt = {
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "scheduler_state_dict": scheduler.state_dict(),
            "epoch": epoch,
            "val_miou": val_miou,
            "val_acc": val_acc,
            "best_miou": max(best_miou, val_miou),
            "config": {
                "num_features": NUM_FEATURES, "num_classes": NUM_CLASSES,
                "k_neighbours": K_NEIGHBOURS, "smoke": bool(args.smoke),
            },
        }
        torch.save(ckpt, os.path.join(args.out_dir, "last.pt"))
        if val_miou > best_miou:
            best_miou = val_miou
            torch.save(ckpt, os.path.join(args.out_dir, "best.pt"))
            print(f"[train] new best val_mIoU={best_miou:.4f} -> best.pt")

    print(f"[train] finished. best val_mIoU={best_miou:.4f}")
    print(f"[train] next: python evaluate.py --checkpoint {args.out_dir}/best.pt --cache-dir {args.cache_dir}")
    print(f"[train] then: python export.py --checkpoint {args.out_dir}/best.pt --out ./meshsegnet.pth")
    if args.smoke:
        print("[smoke] pipeline check complete — do NOT export or deploy these weights")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
