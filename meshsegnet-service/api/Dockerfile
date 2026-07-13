FROM python:3.10-slim

LABEL maintainer="MyOrtho.tech Engineering"
LABEL description="MeshSegNet dental mesh segmentation service — research use only"

# System dependencies for trimesh/scipy mesh processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    libglib2.0-0 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -g 1001 meshsegnet && \
    useradd -u 1001 -g meshsegnet -m -s /bin/bash meshsegnet

WORKDIR /app

# Install Python dependencies as root before dropping privileges
COPY api/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY api/ ./api/

# Checkpoint directory — mount a volume here in production
RUN mkdir -p /ckpts && chown meshsegnet:meshsegnet /ckpts
VOLUME ["/ckpts"]

# Drop to non-root
USER meshsegnet

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8002/health || exit 1

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "1"]
