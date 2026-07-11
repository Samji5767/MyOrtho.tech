#!/usr/bin/env bash
# deploy.sh — Copy TGN service files to /opt/toothgroupnetwork and build the image.
#
# Run from the MyOrtho.tech repo root on the VPS:
#   sudo bash tgn-service/deploy.sh
set -euo pipefail

TGN_DIR="${TGN_DIR:-/opt/toothgroupnetwork}"

echo "==> Deploying TGN service files to $TGN_DIR"

mkdir -p "$TGN_DIR/api" "$TGN_DIR/preprocessing" "$TGN_DIR/scripts"

cp -v tgn-service/api/__init__.py       "$TGN_DIR/api/"
cp -v tgn-service/api/main.py           "$TGN_DIR/api/"
cp -v tgn-service/api/fdi_validator.py  "$TGN_DIR/api/"
cp -v tgn-service/api/requirements.txt  "$TGN_DIR/api/"
cp -v tgn-service/api/Dockerfile        "$TGN_DIR/api/"

cp -v tgn-service/preprocessing/__init__.py     "$TGN_DIR/preprocessing/"
cp -v tgn-service/preprocessing/stl_to_obj.py   "$TGN_DIR/preprocessing/"

cp -v tgn-service/scripts/download_checkpoints.sh "$TGN_DIR/scripts/"
chmod +x "$TGN_DIR/scripts/download_checkpoints.sh"

for md in MODEL_CONFIGURATION INFERENCE_REPORT SEGMENTATION_VALIDATION_REPORT PHASE8_VALIDATION; do
  cp -v "tgn-service/${md}.md" "$TGN_DIR/"
done

echo ""
echo "==> Files deployed. Next steps:"
echo "    1. Download checkpoints (if not already present):"
echo "         $TGN_DIR/scripts/download_checkpoints.sh"
echo "    2. Build TGN API image:"
echo "         docker compose -f $TGN_DIR/docker-compose.yml build tgn-api"
echo "    3. Start the full stack:"
echo "         docker compose -f docker-compose.yml -f docker-compose.tgn.yml up -d"
echo "    4. Verify TGN ready:"
echo "         curl -s http://localhost:8001/ready | jq .model_loaded"
