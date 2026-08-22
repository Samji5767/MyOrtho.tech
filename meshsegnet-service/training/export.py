"""
Export a trained checkpoint into the format the inference service loads.

The service (api/main.py) loads CHECKPOINT_PATH with torch.load and accepts
either a bare state dict or {"model_state_dict": ...}; we export the bare
state dict (the documented default) plus:

  meshsegnet.pth          — bare state dict
  meshsegnet.pth.sha256   — hex digest (feed to CHECKPOINT_SHA256)
  meshsegnet.meta.json    — provenance: source checkpoint, metrics, label map

The export refuses smoke-test checkpoints (train.py --smoke tags them) and
verifies the state dict round-trips through MeshSegNet with strict=True
before writing anything.

    python export.py --checkpoint runs/exp1/best.pt --out ./meshsegnet.pth
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os

import torch

from common import (
    K_NEIGHBOURS,
    NUM_CLASSES,
    NUM_FEATURES,
    MeshSegNet,
    _LOWER_FDI_MAP,
    _UPPER_FDI_MAP,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Export MeshSegNet checkpoint for the inference service")
    parser.add_argument("--checkpoint", required=True, help="training checkpoint (best.pt)")
    parser.add_argument("--out", required=True, help="output path, e.g. ./meshsegnet.pth")
    parser.add_argument("--allow-smoke", action="store_true",
                        help="export even a smoke-run checkpoint (testing the export path only)")
    args = parser.parse_args()

    ckpt = torch.load(args.checkpoint, map_location="cpu")
    if not isinstance(ckpt, dict) or "model_state_dict" not in ckpt:
        print("ERROR: expected a training checkpoint with model_state_dict (train.py output)")
        return 1

    config = ckpt.get("config", {})
    if config.get("smoke") and not args.allow_smoke:
        print("ERROR: this checkpoint came from --smoke (synthetic data). Its weights are "
              "meaningless and must not be deployed. Use --allow-smoke only to test the export path.")
        return 1

    state = ckpt["model_state_dict"]

    # Round-trip validation against the service's model class.
    model = MeshSegNet(num_features=NUM_FEATURES, K=K_NEIGHBOURS)
    model.load_state_dict(state, strict=True)
    model.eval()

    # Forward-pass sanity check on dummy input.
    with torch.no_grad():
        x = torch.randn(32, NUM_FEATURES)
        adj = torch.randint(0, 32, (32, K_NEIGHBOURS))
        out = model(x, adj)
    assert out.shape == (32, NUM_CLASSES), f"unexpected output shape {tuple(out.shape)}"

    torch.save(state, args.out)

    sha256 = hashlib.sha256()
    with open(args.out, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            sha256.update(chunk)
    digest = sha256.hexdigest()
    with open(args.out + ".sha256", "w", encoding="utf-8") as fh:
        fh.write(digest + "\n")

    meta = {
        "format": "bare_state_dict",
        "architecture": "MeshSegNet",
        "num_features": NUM_FEATURES,
        "num_classes": NUM_CLASSES,
        "k_neighbours": K_NEIGHBOURS,
        "source_checkpoint": os.path.abspath(args.checkpoint),
        "epoch": ckpt.get("epoch"),
        "val_miou": ckpt.get("val_miou"),
        "val_acc": ckpt.get("val_acc"),
        "smoke": bool(config.get("smoke")),
        "sha256": digest,
        "label_map": {
            "0": "gingiva",
            "upper_fdi": {str(c): f for c, f in _UPPER_FDI_MAP.items()},
            "lower_fdi": {str(c): f for c, f in _LOWER_FDI_MAP.items()},
        },
        "training_data": "Teeth3DS(+) — verify license and cite (see training/README.md)",
        "clinical_status": "research-grade; NOT clinically validated; outputs require professional review",
    }
    meta_path = os.path.splitext(args.out)[0] + ".meta.json"
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    size_mb = os.path.getsize(args.out) / (1 << 20)
    print(f"[export] wrote {args.out} ({size_mb:.1f} MB)")
    print(f"[export] sha256 {digest}")
    print(f"[export] metadata {meta_path}")
    print("\nDeploy on the VPS:")
    print(f"  scp {args.out} <vps>:/opt/myortho/ckpts/meshsegnet.pth")
    print("  # in the meshsegnet service environment:")
    print(f"  CHECKPOINT_PATH=/ckpts/meshsegnet.pth CHECKPOINT_SHA256={digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
