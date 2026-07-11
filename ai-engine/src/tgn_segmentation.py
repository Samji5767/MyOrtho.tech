"""
TGN segmentation engine proxy.

When TGN_API_URL is set, this module routes segmentation requests to the
ToothGroupNetwork microservice instead of the local MONAI UNet model.

The ai-engine keeps its existing /ai/segment API surface unchanged.
Internally it calls:
  POST {TGN_API_URL}/segment/by-path  — if shared storage is mounted
  POST {TGN_API_URL}/segment          — if file must be uploaded

The TGN API returns results in a format that is translated to the dict
structure expected by run_segmentation_task() in main.py.

Env vars consumed:
  TGN_API_URL          Base URL of the TGN microservice (e.g. http://tgn-api:8001)
  INTERNAL_API_SECRET  Shared bearer secret (same value on both sides)
  TGN_POLL_INTERVAL    Seconds between status polls (default: 2)
  TGN_POLL_MAX_WAIT    Max seconds to wait for job completion (default: 360)
"""

import logging
import os
import time
from typing import Optional

import httpx

logger = logging.getLogger("ai-engine.tgn")

TGN_API_URL: Optional[str] = os.getenv("TGN_API_URL", "").strip() or None
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")
POLL_INTERVAL = float(os.getenv("TGN_POLL_INTERVAL", "2"))
POLL_MAX_WAIT = float(os.getenv("TGN_POLL_MAX_WAIT", "360"))

# Confidence threshold below which a tooth is flagged as uncertain
CONFIDENCE_THRESHOLD = float(os.getenv("SEG_CONFIDENCE_THRESHOLD", "0.50"))

CLINICAL_DISCLAIMER = (
    "AI-assisted recommendation only. "
    "Final treatment decisions remain the responsibility of the licensed orthodontist."
)


class TGNUnavailableError(RuntimeError):
    """Raised when the TGN service cannot be reached or returns an error."""


class TGNSegmentationEngine:
    """
    Proxy that submits segmentation jobs to the TGN microservice and
    polls for results.  Returns a dict compatible with the ai-engine's
    existing run_segmentation_task() job-store format.
    """

    def __init__(self) -> None:
        if not TGN_API_URL:
            raise TGNUnavailableError(
                "TGN_API_URL environment variable is not set. "
                "Start the tgn-api service and set TGN_API_URL."
            )
        self._base = TGN_API_URL.rstrip("/")
        self._headers = {
            "X-Internal-Token": INTERNAL_API_SECRET,
            "Content-Type": "application/json",
        }
        logger.info("TGNSegmentationEngine initialised: base=%s", self._base)

    def _check_health(self) -> bool:
        try:
            with httpx.Client(timeout=5) as client:
                r = client.get(f"{self._base}/health")
                return r.status_code == 200
        except Exception as exc:
            logger.warning("TGN health check failed: %s", exc)
            return False

    def _translate_jaw(self, jaw_type: str) -> str:
        """Normalise ai-engine jaw_type → TGN convention."""
        jaw_lower = jaw_type.lower()
        if jaw_lower in ("maxillary", "upper", "max"):
            return "upper"
        if jaw_lower in ("mandibular", "lower", "mand"):
            return "lower"
        # "combined" and "auto" — send as-is; TGN API handles auto-detection
        return jaw_lower

    def _submit_by_path(self, file_path: str, jaw: str, scan_id: str) -> str:
        """Submit via /segment/by-path (shared volume access)."""
        payload = {"file_path": file_path, "jaw": jaw, "scan_id": scan_id}
        with httpx.Client(timeout=15) as client:
            r = client.post(
                f"{self._base}/segment/by-path",
                json=payload,
                headers=self._headers,
            )
        if r.status_code != 200:
            raise TGNUnavailableError(
                f"TGN /segment/by-path returned {r.status_code}: {r.text[:200]}"
            )
        return r.json()["job_id"]

    def _submit_by_upload(self, file_path: str, jaw: str, scan_id: str) -> str:
        """Submit via multipart upload (no shared volume)."""
        ext = os.path.splitext(file_path)[1].lower()
        headers = {"X-Internal-Token": INTERNAL_API_SECRET}
        with open(file_path, "rb") as fh:
            with httpx.Client(timeout=60) as client:
                r = client.post(
                    f"{self._base}/segment",
                    data={"jaw": jaw, "scan_id": scan_id},
                    files={"file": (os.path.basename(file_path), fh, "application/octet-stream")},
                    headers=headers,
                )
        if r.status_code != 200:
            raise TGNUnavailableError(
                f"TGN /segment returned {r.status_code}: {r.text[:200]}"
            )
        return r.json()["job_id"]

    def _poll_until_complete(self, job_id: str) -> dict:
        """Poll /jobs/{job_id} until status is 'completed' or 'failed'."""
        deadline = time.monotonic() + POLL_MAX_WAIT
        headers = {"X-Internal-Token": INTERNAL_API_SECRET}

        while time.monotonic() < deadline:
            with httpx.Client(timeout=10) as client:
                r = client.get(f"{self._base}/jobs/{job_id}", headers=headers)

            if r.status_code == 404:
                raise TGNUnavailableError(f"Job {job_id} not found on TGN service")

            if r.status_code != 200:
                logger.warning("TGN poll returned %d; retrying", r.status_code)
                time.sleep(POLL_INTERVAL)
                continue

            job = r.json()
            status = job.get("status")

            if status == "completed":
                return job
            if status == "failed":
                raise TGNUnavailableError(
                    f"TGN inference failed: {job.get('error', 'unknown error')}"
                )

            # queued / processing
            time.sleep(POLL_INTERVAL)

        raise TGNUnavailableError(
            f"Timed out waiting for TGN job {job_id} after {POLL_MAX_WAIT}s"
        )

    def segment_mesh(self, file_path: str, jaw_type: str) -> dict:
        """
        Submit segmentation and wait for results.  Returns a dict compatible
        with the existing ai-engine job-store schema.

        Raises TGNUnavailableError on service or inference failure.
        """
        t0 = time.monotonic()
        jaw = self._translate_jaw(jaw_type)
        scan_id = os.path.splitext(os.path.basename(file_path))[0]

        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"Scan file not found: {file_path}")

        # Try by-path first (fast, no upload); fall back to multipart upload
        try:
            job_id = self._submit_by_path(file_path, jaw, scan_id)
            logger.info("Submitted TGN job %s (by-path) for %s", job_id, scan_id)
        except TGNUnavailableError:
            logger.info("by-path failed; falling back to multipart upload")
            job_id = self._submit_by_upload(file_path, jaw, scan_id)
            logger.info("Submitted TGN job %s (upload) for %s", job_id, scan_id)

        job = self._poll_until_complete(job_id)
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        # ── Translate TGN result → ai-engine format ────────────────────────
        tooth_ids = job.get("tooth_ids", [])
        confidence_scores = job.get("confidence_scores", {})
        warnings = job.get("warnings", [])

        if job.get("requires_manual_review"):
            warnings.append(
                "Segmentation requires manual review by a licensed orthodontist."
            )

        # Build confidence_maps in same shape as MONAI engine
        confidence_maps = {
            str(fdi): float(confidence_scores.get(str(fdi), 1.0))
            for fdi in tooth_ids
        }

        return {
            "success": True,
            "jaw_type": job.get("jaw", jaw),
            "requested_jaw_type": jaw_type,
            "tooth_ids": tooth_ids,
            "missing_teeth": job.get("missing_teeth", []),
            "confidence_scores": {
                str(fdi): float(confidence_scores.get(str(fdi), 1.0))
                for fdi in tooth_ids
            },
            "confidence_maps": confidence_maps,
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "fdi_valid": job.get("fdi_valid", True),
            "requires_manual_review": job.get("requires_manual_review", False),
            "deciduous_detected": job.get("deciduous_detected", False),
            "vertex_labels": job.get("vertex_labels", []),
            "vertex_instances": job.get("vertex_instances", []),
            "weights_loaded": True,  # TGN always uses trained weights
            "warning": "; ".join(warnings) if warnings else None,
            "timing": {
                "preprocess_ms": 0,
                "inference_ms": job.get("timing_ms", elapsed_ms),
                "total_ms": elapsed_ms,
            },
            "tgn_job_id": job_id,
            "message": (
                f"TGN segmentation complete. "
                f"Detected {len(tooth_ids)} teeth."
            ),
            "disclaimer": CLINICAL_DISCLAIMER,
        }


def is_tgn_configured() -> bool:
    """Return True if TGN_API_URL is set and the service is reachable."""
    if not TGN_API_URL:
        return False
    try:
        with httpx.Client(timeout=3) as client:
            r = client.get(f"{TGN_API_URL.rstrip('/')}/health")
            return r.status_code == 200
    except Exception:
        return False
