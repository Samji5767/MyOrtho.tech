#!/usr/bin/env bash
# Download MeshSegNet checkpoint weights.
#
# Usage:
#   CKPT_DIR=/ckpts ./scripts/download_checkpoints.sh
#
# Environment variables:
#   CKPT_DIR          Destination directory (default: /ckpts)
#   MESHSEGNET_CKPT_URL  Direct URL to meshsegnet.pth (required)
#   MESHSEGNET_SHA256    Expected SHA-256 hex digest (optional, for verification)
#
# The checkpoint is MIT-licensed model weights from the MeshSegNet authors.
# Verify licensing and attribution requirements before downloading and using.
#
# Citation required when using MeshSegNet:
#   Lian et al., "MeshSegNet: Deep Multi-Scale Mesh Feature Learning for
#   Automated Labeling of Raw Dental Surface from 3D Intraoral Scanners",
#   IEEE Transactions on Medical Imaging, 2021.
#   https://doi.org/10.1109/TMI.2020.3025508

set -euo pipefail

CKPT_DIR="${CKPT_DIR:-/ckpts}"
CKPT_FILE="${CKPT_DIR}/meshsegnet.pth"

# ── Validate required env ─────────────────────────────────────────────────────

if [[ -z "${MESHSEGNET_CKPT_URL:-}" ]]; then
    echo "ERROR: MESHSEGNET_CKPT_URL is not set."
    echo "Set this variable to the direct download URL for meshsegnet.pth."
    echo "Obtain the URL from the MeshSegNet authors or your internal model registry."
    exit 1
fi

# ── Create destination ────────────────────────────────────────────────────────

mkdir -p "${CKPT_DIR}"
echo "Checkpoint directory: ${CKPT_DIR}"

# ── Download ──────────────────────────────────────────────────────────────────

if [[ -f "${CKPT_FILE}" ]]; then
    echo "Checkpoint already exists: ${CKPT_FILE}"
else
    echo "Downloading MeshSegNet checkpoint..."
    wget -q --show-progress \
        --no-check-certificate \
        -O "${CKPT_FILE}" \
        "${MESHSEGNET_CKPT_URL}"
    echo "Downloaded: ${CKPT_FILE}"
fi

# ── SHA-256 verification ──────────────────────────────────────────────────────

if [[ -n "${MESHSEGNET_SHA256:-}" ]]; then
    echo "Verifying SHA-256..."
    ACTUAL_SHA=$(sha256sum "${CKPT_FILE}" | awk '{print $1}')
    if [[ "${ACTUAL_SHA}" != "${MESHSEGNET_SHA256}" ]]; then
        echo "ERROR: SHA-256 mismatch!"
        echo "  Expected: ${MESHSEGNET_SHA256}"
        echo "  Actual:   ${ACTUAL_SHA}"
        rm -f "${CKPT_FILE}"
        exit 1
    fi
    echo "SHA-256 verified: ${ACTUAL_SHA}"
else
    echo "WARN: MESHSEGNET_SHA256 not set — skipping integrity verification."
    echo "      Set this variable in production deployments."
fi

# ── File size sanity check ────────────────────────────────────────────────────

FILE_SIZE=$(stat -c%s "${CKPT_FILE}" 2>/dev/null || stat -f%z "${CKPT_FILE}")
MIN_SIZE=$((10 * 1024 * 1024))  # 10 MB minimum

if [[ "${FILE_SIZE}" -lt "${MIN_SIZE}" ]]; then
    echo "ERROR: Checkpoint file suspiciously small: ${FILE_SIZE} bytes (expected > 10 MB)."
    echo "       The download may have been truncated or the URL may be incorrect."
    rm -f "${CKPT_FILE}"
    exit 1
fi

echo ""
echo "MeshSegNet checkpoint ready."
echo "  Path:  ${CKPT_FILE}"
echo "  Size:  ${FILE_SIZE} bytes"
echo ""
echo "REMINDER: This checkpoint is for research use only."
echo "  Citation: Lian et al., IEEE TMI 2021 — https://doi.org/10.1109/TMI.2020.3025508"
echo "  License: MIT (model architecture). Verify checkpoint redistribution rights separately."
