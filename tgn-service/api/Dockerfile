# ─────────────────────────────────────────────────────────────────────────────
# ToothGroupNetwork API — FastAPI microservice image (CPU mode)
#
# Builds a self-contained service that:
#   1. Installs all TGN Python deps (same as Dockerfile.cpu)
#   2. Installs FastAPI / uvicorn
#   3. Copies TGN source + cpu_compat patch + api/ code
#   4. Exposes the HTTP segmentation API on port 8001
#
# GPU mode: override the FROM line to use the GPU image as base or build
#   with TORCH_CUDA_ARCH_LIST="..." for pointops compilation.
#
# Build:  docker compose build tgn-api
# Run:    docker compose run --rm tgn-api
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.8-slim

LABEL maintainer="MyOrtho.tech <ops@myortho.tech>"
LABEL description="ToothGroupNetwork — segmentation HTTP API"
LABEL tgn.commit="d7e16a4b8fca811975c3a4c7c1429bb0a51b3083"

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        git \
        libgl1-mesa-glx \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# ── PyTorch CPU wheel ─────────────────────────────────────────────────────────
RUN pip install --no-cache-dir --upgrade pip==23.3.2 && \
    pip install --no-cache-dir \
        torch==1.7.1+cpu \
        torchvision==0.8.2+cpu \
        --extra-index-url https://download.pytorch.org/whl/torch_stable.html

# ── TGN + API Python dependencies ─────────────────────────────────────────────
RUN pip install --no-cache-dir --ignore-installed PyYAML==6.0
COPY api/requirements.txt /tmp/api_requirements.txt
RUN pip install --no-cache-dir \
        fastapi==0.111.0 \
        uvicorn==0.30.1 \
        python-multipart==0.0.9 \
        pydantic==2.7.1 \
        redis==5.0.8 && \
    pip install --no-cache-dir \
        open3d==0.16.0 \
        trimesh==3.15.1 \
        numpy==1.21.6 \
        scipy==1.7.3 \
        "scikit-learn==1.0.2" \
        matplotlib==3.5.3 \
        SharedArray==3.2.1 \
        easydict==1.10 \
        "multimethod==1.8" \
        termcolor==1.1.0 \
        "wandb==0.13.11"

# ── Application source ────────────────────────────────────────────────────────
WORKDIR /app
COPY ToothGroupNetwork/ /app/ToothGroupNetwork/
COPY patches/cpu_compat.py /app/cpu_compat.py
COPY preprocessing/ /app/preprocessing/
COPY api/ /app/api/

# ── Smoke-test the imports ─────────────────────────────────────────────────────
RUN cd /app/ToothGroupNetwork && \
    PYTHONPATH=/app/ToothGroupNetwork:/app/ToothGroupNetwork/external_libs:/app \
    python -c " \
import sys; sys.path.insert(0, '/app'); \
import cpu_compat; \
from predict_utils import ScanSegmentation; \
from inference_pipelines.inference_pipeline_maker import make_inference_pipeline; \
print('[tgn-api] imports OK')"

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV PYTHONPATH=/app/ToothGroupNetwork:/app/ToothGroupNetwork/external_libs:/app
ENV PYTHONUNBUFFERED=1
ENV WANDB_MODE=disabled

VOLUME ["/data/input", "/data/output", "/ckpts"]

EXPOSE 8001
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8001"]
