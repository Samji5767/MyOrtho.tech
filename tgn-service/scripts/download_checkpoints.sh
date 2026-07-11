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
# Integrity:
#   After downloading the checkpoints, compute SHA-256 and set environment
#   variables in your .env before starting the TGN service:
#
#     CHECKPOINT_SHA256_FPS=$(sha256sum /path/to/tgnet_fps.h5 | cut -d' ' -f1)
#     CHECKPOINT_SHA256_BDL=$(sha256sum /path/to/tgnet_bdl.h5 | cut -d' ' -f1)
#     REQUIRE_CHECKSUM=true
#
#   When REQUIRE_CHECKSUM=true, the TGN service will refuse to start if the
#   computed hash does not match the expected value.
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
# Direct file ID for the zip archive — update if the Drive link changes
CKPTS_ZIP_ID="1oWFEV9c9RLj3FLsLqYolFuE_6hBk8h4C"

# ── sha256_file helper ────────────────────────────────────────────────────────

sha256_file() {
    local path="$1"
    if command -v sha256sum &>/dev/null; then
        sha256sum "$path" | cut -d' ' -f1
    elif command -v shasum &>/dev/null; then
        shasum -a 256 "$path" | cut -d' ' -f1
    else
        error "sha256sum / shasum not found; cannot verify checksums"
        return 1
    fi
}

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

# ── Download if needed ────────────────────────────────────────────────────────
if [ "$all_present" = false ]; then
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
            ZIP_PATH=""
        else
            error "gdown failed. Download manually from:"
            error "  https://drive.google.com/drive/folders/$GDRIVE_FOLDER_ID"
            exit 1
        fi
    fi

    if [ -n "${ZIP_PATH:-}" ] && [ -f "$ZIP_PATH" ]; then
        info "Extracting $ZIP_PATH ..."
        unzip -o "$ZIP_PATH" -d "$CKPTS_DIR"
        rm -f "$ZIP_PATH"
        ok "Extracted checkpoints"
    fi

    # Move files if gdown created a subfolder
    for f in "$CKPTS_DIR"/ckpts*/*.h5 "$CKPTS_DIR"/ckpts/*.h5; do
        [ -f "$f" ] && mv "$f" "$CKPTS_DIR/" && ok "Moved $(basename "$f")"
    done
fi

# ── Verify presence ───────────────────────────────────────────────────────────
echo ""
info "Verifying checkpoint files..."
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

if [ "$all_ok" = false ]; then
    error "Some checkpoints are missing. Check the Google Drive link and retry."
    exit 1
fi

# ── Compute and record SHA-256 ────────────────────────────────────────────────
echo ""
info "Computing SHA-256 checksums..."
FPS_SHA256=$(sha256_file "$CKPTS_DIR/tgnet_fps.h5")
BDL_SHA256=$(sha256_file "$CKPTS_DIR/tgnet_bdl.h5")
ok "tgnet_fps.h5  sha256=${FPS_SHA256}"
ok "tgnet_bdl.h5  sha256=${BDL_SHA256}"

# Write checksums to a sidecar file
SIDECAR="$CKPTS_DIR/checksums.sha256"
cat > "$SIDECAR" <<EOF
# TGN checkpoint SHA-256 checksums
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Verify with: sha256sum -c $SIDECAR
${FPS_SHA256}  tgnet_fps.h5
${BDL_SHA256}  tgnet_bdl.h5
EOF
ok "Checksums written to: $SIDECAR"

echo ""
ok "All checkpoints downloaded and verified."
echo ""
echo "Add these to your .env file before starting the TGN service:"
echo ""
echo "  TGNET_FPS_CHECKPOINT=$CKPTS_DIR/tgnet_fps.h5"
echo "  TGNET_BDL_CHECKPOINT=$CKPTS_DIR/tgnet_bdl.h5"
echo "  CHECKPOINT_SHA256_FPS=$FPS_SHA256"
echo "  CHECKPOINT_SHA256_BDL=$BDL_SHA256"
echo "  REQUIRE_CHECKSUM=true"
echo "  TGN_ENABLED=true"
echo ""
warn "Set TGN_ENABLED=true ONLY after reviewing the SEGMENTATION_VALIDATION_REPORT.md"
warn "and completing clinical validation on your scan dataset."
