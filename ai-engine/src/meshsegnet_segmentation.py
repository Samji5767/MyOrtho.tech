"""
MeshSegNet segmentation engine proxy.

Routes segmentation requests to the MeshSegNet microservice on port 8002.
Mirrors the interface of tgn_segmentation.py so both engines are
interchangeable inside SegmentationRouter.

Env vars consumed:
  MESHSEGNET_API_URL     Base URL of the MeshSegNet service (e.g. http://meshsegnet-api:8002)
  INTERNAL_API_SECRET    Shared bearer secret (same value on both sides)
  MESHSEGNET_POLL_INTERVAL  Seconds between status polls (default: 2)
  MESHSEGNET_POLL_MAX_WAIT  Max seconds to wait for job completion (default: 360)
"""

import logging
import os
import time
from typing import Optional

import httpx

logger = logging.getLogger("ai-engine.meshsegnet")

MESHSEGNET_API_URL: Optional[str] = os.getenv("MESHSEGNET_API_URL", "").strip() or None
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")
POLL_INTERVAL = float(os.getenv("MESHSEGNET_POLL_INTERVAL", "2"))
POLL_MAX_WAIT = float(os.getenv("MESHSEGNET_POLL_MAX_WAIT", "360"))

CONFIDENCE_THRESHOLD = float(os.getenv("SEG_CONFIDENCE_THRESHOLD", "0.50"))

CLINICAL_DISCLAIMER = (
    "AI-assisted recommendation only. "
    "Final treatment decisions remain the responsibility of the licensed orthodontist."
)


class MeshSegNetUnavailableError(RuntimeError):
    """Raised when the MeshSegNet service cannot be reached or returns an error."""


class MeshSegNetEngine:
    """
    Proxy that submits segmentation jobs to the MeshSegNet microservice and
    polls for results.  Returns a dict compatible with the ai-engine's
    existing job-store format.
    """

    def __init__(self) -> None:
        if not MESHSEGNET_API_URL:
            raise MeshSegNetUnavailableError(
                "MESHSEGNET_API_URL environment variable is not set. "
                "Start the meshsegnet-api service and set MESHSEGNET_API_URL."
            )
        self._base = MESHSEGNET_API_URL.rstrip("/")
        self._headers = {
            "X-Internal-Token": INTERNAL_API_SECRET,
            "Content-Type": "application/json",
        }
        logger.info("MeshSegNetEngine initialised: base=%s", self._base)

    def _check_health(self) -> bool:
        try:
            with httpx.Client(timeout=5) as client:
                r = client.get(f"{self._base}/health")
                return r.status_code == 200
        except Exception as exc:
            logger.warning("MeshSegNet health check failed: %s", exc)
            return False

    def _translate_jaw(self, jaw_type: str) -> str:
        jaw_lower = jaw_type.lower()
        if jaw_lower in ("maxillary", "upper", "max"):
            return "upper"
        if jaw_lower in ("mandibular", "lower", "mand"):
            return "lower"
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
            raise MeshSegNetUnavailableError(
                f"MeshSegNet /segment/by-path returned {r.status_code}: {r.text[:200]}"
            )
        return r.json()["job_id"]

    def _submit_by_upload(self, file_path: str, jaw: str, scan_id: str) -> str:
        """Submit via multipart upload (no shared volume)."""
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
            raise MeshSegNetUnavailableError(
                f"MeshSegNet /segment returned {r.status_code}: {r.text[:200]}"
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
                raise MeshSegNetUnavailableError(f"Job {job_id} not found on MeshSegNet service")

            if r.status_code != 200:
                logger.warning("MeshSegNet poll returned %d; retrying", r.status_code)
                time.sleep(POLL_INTERVAL)
                continue

            job = r.json()
            status = job.get("status")

            if status == "completed":
                return job
            if status == "failed":
                raise MeshSegNetUnavailableError(
                    f"MeshSegNet inference failed: {job.get('error', 'unknown error')}"
                )

            time.sleep(POLL_INTERVAL)

        raise MeshSegNetUnavailableError(
            f"Timed out waiting for MeshSegNet job {job_id} after {POLL_MAX_WAIT}s"
        )

    def segment_mesh(self, file_path: str, jaw_type: str) -> dict:
        """
        Submit segmentation and wait for results.  Returns a dict compatible
        with the existing ai-engine job-store schema.

        Raises MeshSegNetUnavailableError on service or inference failure.
        """
        t0 = time.monotonic()
        jaw = self._translate_jaw(jaw_type)
        scan_id = os.path.splitext(os.path.basename(file_path))[0]

        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"Scan file not found: {file_path}")

        try:
            job_id = self._submit_by_path(file_path, jaw, scan_id)
            logger.info("Submitted MeshSegNet job %s (by-path) for %s", job_id, scan_id)
        except MeshSegNetUnavailableError:
            logger.info("by-path failed; falling back to multipart upload")
            job_id = self._submit_by_upload(file_path, jaw, scan_id)
            logger.info("Submitted MeshSegNet job %s (upload) for %s", job_id, scan_id)

        job = self._poll_until_complete(job_id)
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        tooth_ids = job.get("tooth_ids", [])
        confidence_scores = job.get("confidence_scores", {})
        warnings = job.get("warnings", [])

        if job.get("requires_manual_review"):
            warnings.append(
                "Segmentation requires manual review by a licensed orthodontist."
            )

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
            "weights_loaded": True,
            "warning": "; ".join(warnings) if warnings else None,
            "timing": {
                "preprocess_ms": 0,
                "inference_ms": job.get("timing_ms", elapsed_ms),
                "total_ms": elapsed_ms,
            },
            "meshsegnet_job_id": job_id,
            "message": (
                f"MeshSegNet segmentation complete. "
                f"Detected {len(tooth_ids)} teeth."
            ),
            "disclaimer": CLINICAL_DISCLAIMER,
        }


def is_meshsegnet_configured() -> bool:
    """Return True if MESHSEGNET_API_URL is set and the service is reachable."""
    if not MESHSEGNET_API_URL:
        return False
    try:
        with httpx.Client(timeout=3) as client:
            r = client.get(f"{MESHSEGNET_API_URL.rstrip('/')}/health")
            return r.status_code == 200
    except Exception:
        return False
