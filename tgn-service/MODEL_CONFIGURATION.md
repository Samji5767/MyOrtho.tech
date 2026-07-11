# ToothGroupNetwork — Model Configuration

## 1. Pretrained Checkpoint Source

Official checkpoints are published by the MICCAI 2022 3D Teeth Scan Segmentation
Challenge organisers alongside the ToothGroupNetwork repository:

| Resource | URL |
|----------|-----|
| GitHub repository | https://github.com/limhoyeon/ToothGroupNetwork |
| Checkpoint archive | https://drive.google.com/drive/folders/15oP0CZM_O_-Bir18VbSM8wRUEzoyLXby |
| Archive filename | `ckpts(new).zip` |

## 2. Checkpoint Inventory

| File | Model | Purpose | GPU required |
|------|-------|---------|-------------|
| `tgnet_fps.h5` | TGNet FPS module | First-pass tooth detection via farthest-point sampling | No |
| `tgnet_bdl.h5` | TGNet Boundary module | Boundary-aware tooth delineation (stage 2) | No |
| `tsegnet_centroid.h5` | TSegNet centroid | TSegNet pipeline — centroid prediction | No |
| `tsegnet_seg.h5` | TSegNet segmentation | TSegNet pipeline — per-tooth segmentation | No |
| `pointnet.h5` | PointNet | Baseline comparison | No |
| `pointnetpp.h5` | PointNet++ | Baseline comparison | No |
| `dgcnn.h5` | DGCNN | Baseline comparison | No |
| `pointtransformer.h5` | PointTransformer | Highest accuracy; requires pointops CUDA extension | **Yes** |

## 3. Download Instructions

### Automatic (requires `gdown`)

```bash
pip install gdown
/opt/toothgroupnetwork/scripts/download_checkpoints.sh
```

### Manual

1. Open: https://drive.google.com/drive/folders/15oP0CZM_O_-Bir18VbSM8wRUEzoyLXby
2. Download `ckpts(new).zip`
3. Unzip into `/opt/toothgroupnetwork/ckpts/`

### Verification

```bash
ls -lh /opt/toothgroupnetwork/ckpts/
# Expected output (sizes approximate):
# tgnet_fps.h5      ~80 MB
# tgnet_bdl.h5      ~80 MB
# ...
```

## 4. Environment Variables

Set these before starting the `tgn-api` service:

| Variable | Default | Description |
|----------|---------|-------------|
| `TGNET_FPS_CHECKPOINT` | `/ckpts/tgnet_fps.h5` | Path to TGNet FPS checkpoint |
| `TGNET_BDL_CHECKPOINT` | `/ckpts/tgnet_bdl.h5` | Path to TGNet boundary checkpoint |
| `TGN_MODEL_NAME` | `tgnet_fps` | Active inference model |
| `TGN_TIMEOUT_SEC` | `300` | Inference timeout (seconds) |

Add to `.env` or `docker-compose.tgn.yml`:

```env
TGNET_FPS_CHECKPOINT=/ckpts/tgnet_fps.h5
TGNET_BDL_CHECKPOINT=/ckpts/tgnet_bdl.h5
TGNET_CKPTS_DIR=/opt/toothgroupnetwork/ckpts
```

## 5. Model Initialization Verification

After starting the service, verify the model loaded:

```bash
curl -s http://localhost:8001/ready | jq .
```

Expected output when checkpoints are configured:

```json
{
  "ready": true,
  "model_loaded": true,
  "model_error": null,
  "device": "cpu",
  "gpu_acceleration": false,
  "model_name": "tgnet_fps",
  "checkpoint_fps": "/ckpts/tgnet_fps.h5",
  "checkpoint_bdl": "/ckpts/tgnet_bdl.h5",
  "disclaimer": "AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist."
}
```

If `model_loaded` is `false`, check `model_error` for the specific failure reason.

## 6. CPU Fallback

The `cpu_compat.py` patch enables CPU inference by:
- Replacing `gen_utils.fps()` (which calls the CUDA `pointops.furthestsampling()`)
  with a pure-PyTorch iterative FPS implementation.
- Patching `InferencePipeLine.__init__()` to use `.to(device)` instead of `.cuda()`.

CPU inference on a typical 50k-vertex scan takes **30–60 seconds** per jaw.
GPU inference takes **1–3 seconds** per jaw.

## 7. GPU Support

For GPU inference, rebuild the TGN API image from the GPU Dockerfile:

```bash
cd /opt/toothgroupnetwork
docker compose build tgn-gpu
```

Or use the GPU variant in docker-compose:

```yaml
tgn-api:
  image: toothgroupnetwork-tgn-gpu:latest
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

Supported GPU architectures: Pascal (sm_61), Turing (sm_75), Ampere A100 (sm_80), Ampere RTX 30xx (sm_86).

## 8. Model Architecture Summary

**TGNet (winner of 3D Teeth Scan Segmentation Challenge, MICCAI 2022)**

| Property | Value |
|----------|-------|
| Input | 3D point cloud, 24,000 sampled points |
| Point features | XYZ coordinates + vertex normals (6D) |
| Stage 1 | GroupingNetworkModule (FPS-based) → coarse tooth instances |
| Stage 2 | GroupingNetworkModule (Boundary-aware) → refined boundaries |
| Output | Per-vertex semantic label (FDI code) + instance ID |
| Published DSC | ≥ 0.95 on challenge test set (MICCAI 2022) |

**FDI output convention:**
- Upper jaw scans: labels in range 11–28
- Lower jaw scans: raw labels + 20 → range 31–48
- Label 0 = gingiva / background

## 9. Checkpoint Integrity

After downloading, confirm file sizes are reasonable (empty or corrupt `.h5` files
produce `KeyError` on load):

```bash
python3 -c "
import h5py, os
for f in ['tgnet_fps.h5', 'tgnet_bdl.h5']:
    path = f'/opt/toothgroupnetwork/ckpts/{f}'
    if not os.path.exists(path):
        print(f'MISSING: {f}')
        continue
    try:
        with h5py.File(path, 'r') as h:
            keys = list(h.keys())
        print(f'OK  {f}  keys={keys[:3]}...')
    except Exception as e:
        print(f'CORRUPT  {f}  {e}')
"
```

## 10. Clinical Disclaimer

> **AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist.**
>
> The ToothGroupNetwork model is a research prototype. It has not been cleared as Software as a Medical Device (SaMD) by any regulatory body. Outputs must be reviewed and validated by a licensed clinician before any clinical decision.
