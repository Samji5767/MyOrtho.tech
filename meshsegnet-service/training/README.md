# MeshSegNet training pipeline

Trains the tooth-segmentation model used by `meshsegnet-service` and exports
checkpoints that the service loads directly (`CHECKPOINT_PATH`, bare state
dict, optional `CHECKPOINT_SHA256` verification).

The training code imports the **service's own** `api/model.py` and
`api/feature_extraction.py` — there is a single source of truth for the
architecture, the 15-dim per-face features, and the class→FDI label maps, so
a checkpoint trained here is guaranteed to load in production unchanged.

## Honest status

- This directory contains a complete, runnable pipeline. **No trained
  weights are checked in** — training requires a GPU and the Teeth3DS(+)
  dataset, which you must download and license-verify yourself (below).
- The result is **research-grade**. It is not a medical device, has not been
  clinically validated, and its output must always pass professional review
  (the platform's `review_required` flow enforces this).
- `--smoke` mode runs the full pipeline on synthetic data to verify the code
  path on CPU; its weights are meaningless and `export.py` refuses them.

## 1. Dataset: Teeth3DS / Teeth3DS+

Teeth3DS+ (the extended release of the MICCAI 3DTeethSeg'22 challenge data)
contains ~1,800 annotated intraoral scans (upper + lower jaws, per-vertex FDI
labels). Start here:

- Challenge / dataset page: https://github.com/abenhamadou/3DTeethSeg22_challenge
- Teeth3DS+ page: https://crns-smartvision.github.io/teeth3ds/

**Before downloading, verify the license terms on the official record
yourself** (reported as CC BY 4.0 at the time this pipeline was written, but
the record is authoritative). If you use the data or a model trained on it,
you must provide the attribution the license requires, at minimum citing:

- Ben-Hamadou et al., *Teeth3DS+: An Extended Benchmark for Intraoral 3D
  Scans Analysis* (dataset release).
- Ben-Hamadou et al., *3DTeethSeg'22: 3D Teeth Scan Segmentation and
  Labeling Challenge*, MICCAI 2022.
- Lian et al., *MeshSegNet: Deep Multi-Scale Mesh Feature Learning for
  Automated Labeling of Raw Dental Surface from 3D Intraoral Scanners*,
  IEEE TMI 2021, doi:10.1109/TMI.2020.3025508 (architecture; original code
  released under MIT).

Expected raw layout after download/extraction — any nesting works, files are
discovered recursively and paired by basename:

```
raw/
  0EJBIPTC/
    0EJBIPTC_upper.obj     # intraoral scan mesh
    0EJBIPTC_upper.json    # {"jaw": "upper", "labels": [FDI per vertex, 0=gingiva], ...}
    0EJBIPTC_lower.obj
    0EJBIPTC_lower.json
  ...
```

## 2. GPU box setup

Any single CUDA GPU with ≥8 GB VRAM works (the model is small — ~2M params —
the memory cost is the per-mesh KNN/feature tensors). Tested plan: rent an
hourly GPU instance, then:

```bash
git clone https://github.com/samji5767/myortho.tech.git
cd myortho.tech/meshsegnet-service/training
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt   # pick the torch wheel for your CUDA version
```

Verify the pipeline end-to-end before spending money on the real run:

```bash
python train.py --smoke --out-dir /tmp/smoke   # CPU, ~1 min, synthetic data
```

## 3. Preprocess

Converts raw scans to a cached `.npz` per scan (features, KNN adjacency,
per-face class labels). Resumable — rerun skips already-cached scans.

```bash
python dataset.py --raw-dir /data/teeth3ds/raw --out-dir /data/teeth3ds/cache \
    --sample-faces 10000
```

Notes:
- Per-vertex FDI labels become per-face labels by majority vote; FDI → raw
  class 0–16 uses the inverse of the service's jaw maps.
- Faces are randomly subsampled to `--sample-faces` (default 10,000) because
  the service's brute-force KNN is O(F²) in memory (~1.2 GB at 10k faces).
  Inference in the service runs on the full mesh; this train-time
  subsampling matches the original MeshSegNet training protocol.
- Scans with mismatched label counts or degenerate meshes are skipped and
  reported, never silently included.

## 4. Train

```bash
python train.py --cache-dir /data/teeth3ds/cache --out-dir runs/exp1 \
    --epochs 60 --lr 1e-3 --device cuda
```

- One mesh per step (the global-pooling branch precludes concatenated
  batching); `--accum 4` accumulates gradients for an effective batch of 4.
- Loss: class-weighted NLL + soft Dice (`--dice-weight 0.5`) to counter the
  gingiva/tooth imbalance.
- Split is case-level (a patient's upper and lower scans never straddle
  train/val). Use `--split-file` with the official challenge test lists for
  comparable numbers.
- `runs/exp1/best.pt` tracks best val mIoU; `last.pt` + `--resume` handle
  interruption (hourly GPU boxes die — checkpointing is per-epoch).
- Progress lands in `runs/exp1/train_log.jsonl`.

Rough expectation from the literature: MeshSegNet-family models reach
~0.90+ overall accuracy on Teeth3DS-style data; if val mIoU plateaus far
below that, inspect the preprocessing before blaming the model.

## 5. Evaluate

```bash
python evaluate.py --checkpoint runs/exp1/best.pt --cache-dir /data/teeth3ds/cache \
    --split-file testing_ids.txt --report eval_report.json
```

Reports overall accuracy, mean IoU/Dice, teeth-only mIoU (excluding
gingiva), and a per-class table with FDI codes for both jaws. Keep
`eval_report.json` with the exported checkpoint — it is the evidence for
what the model actually does.

## 6. Export + deploy

```bash
python export.py --checkpoint runs/exp1/best.pt --out ./meshsegnet.pth
```

Writes `meshsegnet.pth` (bare state dict), `meshsegnet.pth.sha256`, and
`meshsegnet.meta.json` (provenance + label map + metrics). The export
validates the state dict against the service's model class (strict load +
forward pass) and refuses smoke-run checkpoints.

On the VPS (the service is wired into docker-compose behind the
`meshsegnet` profile; checkpoints live in the `meshsegnet_ckpts` volume):

```bash
scp meshsegnet.pth root@<vps>:/opt/myortho/
# in /opt/myortho/.env set:
#   COMPOSE_PROFILES=meshsegnet
#   MESHSEGNET_ENABLED=true
#   MESHSEGNET_CHECKPOINT_SHA256=<contents of meshsegnet.pth.sha256>
#   SEGMENTATION_PROVIDER=MESHSEGNET
#   SEGMENTATION_PRIMARY=MESHSEGNET
cd /opt/myortho
docker compose up -d meshsegnet                       # create the container + volume
docker cp meshsegnet.pth myortho-meshsegnet:/ckpts/meshsegnet.pth
docker compose restart meshsegnet ai-engine           # hash is verified at startup
docker inspect --format='{{.State.Health.Status}}' myortho-meshsegnet
```

## File map

| File | Purpose |
|---|---|
| `common.py` | imports the service's model/features; FDI↔class inverse maps |
| `dataset.py` | raw Teeth3DS → `.npz` cache; dataset class; case-level splits |
| `train.py` | training loop, weighted NLL + Dice, checkpointing, `--smoke` |
| `evaluate.py` | confusion matrix, per-class IoU/Dice, JSON report |
| `export.py` | service-compatible export + SHA-256 + provenance metadata |

Do not commit datasets, caches, checkpoints, or exported weights to the
repository (see `.gitignore` in this directory).
