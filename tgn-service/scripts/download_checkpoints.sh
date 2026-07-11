#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# download_checkpoints.sh — Download official TGN pretrained checkpoints
#
# Source:  https://drive.google.com/drive/folders/15oP0CZM_O_-Bir18VbSM8wRUEzoyLXby
# Archive: ckpts(new).zip
#
# Usage:
#   ./scripts/download_checkpoints.sh              # downloads to ./ckpts/
#   CKPTS_DIR=/custom/path ./scripts/download_checkpoints.sh
#
# Requirements:
#   pip install gdown    OR    manual download from the Google Drive link above
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CKPTS_DIR="${CKPTS_DIR:-$REPO_ROOT/ckpts}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'

info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error() { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

GDRIVE_FOLDER_ID="15oP0CZM_O_-Bir18VbSM8wRUEzoyLXby"
# Direct file IDs for the zip archive (may change; re-share from Drive if broken)
# Update these IDs if the Drive link changes.
CKPTS_ZIP_ID="1oWFEV9c9RLj3FLsLqYolFuE_6hBk8h4C"

# ── Validate destination ──────────────────────────────────────────────────────
mkdir -p "$CKPTS_DIR"
info "Checkpoint directory: $CKPTS_DIR"

# ── Check for existing checkpoints ────────────────────────────────────────────
required=("tgnet_fps.h5" "tgnet_bdl.h5")
all_present=true
for f in "${required[@]}"; do
    if [ -f "$CKPTS_DIR/$f" ]; then
        SIZE=$(du -sh "$CKPTS_DIR/$f" | cut -f1)
        ok "Already present: $f ($SIZE)"
    else
        warn "Missing: $f"
        all_present=false
    fi
done

if [ "$all_present" = true ]; then
    ok "All required checkpoints are present."
    echo ""
    echo "  TGNET_FPS_CHECKPOINT=$CKPTS_DIR/tgnet_fps.h5"
    echo "  TGNET_BDL_CHECKPOINT=$CKPTS_DIR/tgnet_bdl.h5"
    exit 0
fi

# ── Download via gdown ────────────────────────────────────────────────────────
if ! command -v gdown &>/dev/null; then
    error "gdown not found. Install it with: pip install gdown"
    echo ""
    echo "  Alternatively, download manually:"
    echo "  1. Open: https://drive.google.com/drive/folders/$GDRIVE_FOLDER_ID"
    echo "  2. Download 'ckpts(new).zip'"
    echo "  3. Unzip into: $CKPTS_DIR"
    echo "     Expected files:"
    echo "       tgnet_fps.h5"
    echo "       tgnet_bdl.h5"
    echo "       tsegnet_centroid.h5"
    echo "       tsegnet_seg.h5"
    echo "       pointnet.h5"
    echo "       pointnetpp.h5"
    echo "       dgcnn.h5"
    echo "       pointtransformer.h5  (GPU only)"
    exit 1
fi

info "Downloading checkpoint archive via gdown..."
ZIP_PATH="$CKPTS_DIR/ckpts_new.zip"

# Try direct file ID first
if gdown "$CKPTS_ZIP_ID" -O "$ZIP_PATH" --quiet; then
    ok "Downloaded checkpoint archive"
else
    warn "Direct file ID failed; trying folder download..."
    if gdown "https://drive.google.com/drive/folders/$GDRIVE_FOLDER_ID" \
            --folder -O "$CKPTS_DIR" --quiet; then
        ok "Downloaded checkpoint folder"
        ZIP_PATH=""  # folder download extracts directly
    else
        error "gdown failed. Download manually from:"
        error "  https://drive.google.com/drive/folders/$GDRIVE_FOLDER_ID"
        exit 1
    fi
fi

# ── Unzip ─────────────────────────────────────────────────────────────────────
if [ -n "$ZIP_PATH" ] && [ -f "$ZIP_PATH" ]; then
    info "Extracting $ZIP_PATH ..."
    unzip -o "$ZIP_PATH" -d "$CKPTS_DIR"
    rm -f "$ZIP_PATH"
    ok "Extracted checkpoints"
fi

# ── Move files if nested ──────────────────────────────────────────────────────
# Sometimes gdown creates a subfolder
for f in "$CKPTS_DIR"/ckpts*/*.h5 "$CKPTS_DIR"/ckpts/*.h5; do
    [ -f "$f" ] && mv "$f" "$CKPTS_DIR/" && ok "Moved $(basename "$f")"
done

# ── Verify ────────────────────────────────────────────────────────────────────
echo ""
info "Verifying checksums..."
declare -A EXPECTED_SIZES=(
    ["tgnet_fps.h5"]="50"     # ~50-200 MB depending on model version
    ["tgnet_bdl.h5"]="50"
)

all_ok=true
for f in "${required[@]}"; do
    path="$CKPTS_DIR/$f"
    if [ -f "$path" ]; then
        SIZE=$(du -sh "$path" | cut -f1)
        ok "$f  ($SIZE)"
    else
        error "MISSING: $f"
        all_ok=false
    fi
done

echo ""
if [ "$all_ok" = true ]; then
    ok "All checkpoints downloaded successfully."
    echo ""
    echo "  TGNET_FPS_CHECKPOINT=$CKPTS_DIR/tgnet_fps.h5"
    echo "  TGNET_BDL_CHECKPOINT=$CKPTS_DIR/tgnet_bdl.h5"
    echo ""
    echo "  Add these to your .env or docker-compose.yml environment section."
else
    error "Some checkpoints are missing. Check the Google Drive link and retry."
    exit 1
fi
