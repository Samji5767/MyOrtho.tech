"""
MeshSegNet segmentation microservice.

Mirrors the job lifecycle of the TGN service so that the ai-engine router
can treat both services interchangeably.

Endpoints:
  GET  /health              — liveness probe
  GET  /ready               — readiness (model loaded)
  GET  /version             — engine metadata
  GET  /metrics             — Prometheus text metrics
  POST /segment             — upload file + segment
  POST /segment/by-path     — segment by shared-volume file path
  GET  /jobs/{job_id}       — poll job status

Environment variables:
  MESHSEGNET_ENABLED        true/false (default: false)
  MESHSEGNET_MODEL_VERSION  version string (default: 1.0.0)
  CHECKPOINT_PATH           Path to meshsegnet.pth (default: /ckpts/meshsegnet.pth)
  CHECKPOINT_SHA256         Expected SHA-256 of checkpoint (optional)
  INTERNAL_API_SECRET       Shared secret for X-Internal-Token validation
  MAX_UPLOAD_BYTES          Maximum upload size (default: 52428800 = 50 MB)
  CONFIDENCE_THRESHOLD      Minimum per-tooth confidence (default: 0.50)
  DEVICE                    torch device string (default: cpu)

Research use only: MESHSEGNET_ENABLED defaults to false in production.
Every response carries research_use=true and the clinical disclaimer.
"""
from __future__ import annotations

import hashlib
import logging
import os
import tempfile
import time
import uuid
from enum import Enum
from typing import Dict, List, Optional

import torch
import trimesh
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from api.feature_extraction import extract_features
from api.fdi_validator import (
    compute_per_face_softmax_confidence,
    validate_fdi_sequence,
)
from api.model import MeshSegNet, class_labels_to_fdi

# ── Configuration ─────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("meshsegnet-service")

MESHSEGNET_ENABLED: bool = os.getenv("MESHSEGNET_ENABLED", "false").lower() == "true"
MODEL_VERSION: str = os.getenv("MESHSEGNET_MODEL_VERSION", "1.0.0")
CHECKPOINT_PATH: str = os.getenv("CHECKPOINT_PATH", "/ckpts/meshsegnet.pth")
EXPECTED_SHA256: str = os.getenv("CHECKPOINT_SHA256", "")
INTERNAL_SECRET: str = os.getenv("INTERNAL_API_SECRET", "")
MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))
CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.50"))
DEVICE_STR: str = os.getenv("DEVICE", "cpu")

CLINICAL_DISCLAIMER = (
    "Research-use segmentation. Manual clinical review required. "
    "AI-assisted recommendation only. "
    "Final treatment decisions remain the responsibility of the licensed orthodontist."
)

# ── State ─────────────────────────────────────────────────────────────────────


class MeshSegNetState(str, Enum):
    DISABLED = "disabled"
    LOADING = "loading"
    READY = "ready"
    ERROR = "error"


_state = MeshSegNetState.DISABLED
_model: Optional[MeshSegNet] = None
_device: Optional[torch.device] = None
_checkpoint_sha256: Optional[str] = None
_load_error: Optional[str] = None

# In-memory job store (production deployments should back this with Redis)
_jobs: Dict[str, dict] = {}

# Prometheus-style counters
_counters: Dict[str, int] = {
    "requests_total": 0,
    "successes_total": 0,
    "failures_total": 0,
    "manual_review_total": 0,
    "validation_failures_total": 0,
    "duration_ms_sum": 0,
    "duration_ms_count": 0,
}
_started_at = time.time()


# ── Model loading ─────────────────────────────────────────────────────────────

def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_model() -> None:
    global _state, _model, _device, _checkpoint_sha256, _load_error

    if not MESHSEGNET_ENABLED:
        _state = MeshSegNetState.DISABLED
        logger.info("MeshSegNet is disabled (MESHSEGNET_ENABLED=false)")
        return

    _state = MeshSegNetState.LOADING
    logger.info("Loading MeshSegNet checkpoint from %s", CHECKPOINT_PATH)

    try:
        if not os.path.isfile(CHECKPOINT_PATH):
            raise FileNotFoundError(f"Checkpoint not found: {CHECKPOINT_PATH}")

        actual_sha = _sha256_file(CHECKPOINT_PATH)
        if EXPECTED_SHA256 and actual_sha != EXPECTED_SHA256:
            raise ValueError(
                f"Checkpoint SHA-256 mismatch: expected {EXPECTED_SHA256}, got {actual_sha}"
            )
        _checkpoint_sha256 = actual_sha

        _device = torch.device(DEVICE_STR)
        model = MeshSegNet()
        state_dict = torch.load(CHECKPOINT_PATH, map_location=_device)
        # Accept both bare state dicts and wrapped {"model_state_dict": ...}
        if isinstance(state_dict, dict) and "model_state_dict" in state_dict:
            state_dict = state_dict["model_state_dict"]
        model.load_state_dict(state_dict)
        model.to(_device)
        model.eval()
        _model = model

        _state = MeshSegNetState.READY
        logger.info(
            "MeshSegNet ready — sha256=%s device=%s", _checkpoint_sha256[:16], DEVICE_STR
        )
    except Exception as exc:
        _load_error = str(exc)
        _state = MeshSegNetState.ERROR
        logger.error("Failed to load MeshSegNet: %s", exc)


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="MeshSegNet Segmentation Service",
    description="Per-face mesh segmentation using MeshSegNet (IEEE TMI 2021). Research use only.",
    version=MODEL_VERSION,
)


@app.on_event("startup")
def _on_startup() -> None:
    _load_model()


# ── Auth helper ───────────────────────────────────────────────────────────────

def _require_internal_token(x_internal_token: Optional[str] = None) -> None:
    if not INTERNAL_SECRET:
        return  # No secret configured — skip validation (dev/test mode)
    if x_internal_token != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Invalid X-Internal-Token")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {
        "status": "ok" if _state != MeshSegNetState.ERROR else "error",
        "engine": "meshsegnet",
        "version": MODEL_VERSION,
        "state": _state.value,
        "enabled": MESHSEGNET_ENABLED,
        "error": _load_error,
    }


@app.get("/ready")
def ready() -> dict:
    if _state != MeshSegNetState.READY:
        raise HTTPException(
            status_code=503,
            detail=f"MeshSegNet not ready: state={_state.value} error={_load_error}",
        )
    return {"ready": True, "engine": "meshsegnet", "version": MODEL_VERSION}


@app.get("/version")
def version() -> dict:
    return {
        "engine": "meshsegnet",
        "version": MODEL_VERSION,
        "state": _state.value,
        "checkpoint_sha256": _checkpoint_sha256,
        "device": DEVICE_STR,
        "reference": "Lian et al., IEEE TMI 2021 — https://doi.org/10.1109/TMI.2020.3025508",
        "license": "MIT",
        "research_use": True,
        "disclaimer": CLINICAL_DISCLAIMER,
    }


@app.get("/metrics", response_class=PlainTextResponse)
def metrics_prometheus() -> str:
    uptime = int(time.time() - _started_at)
    lines = [
        "# HELP meshsegnet_uptime_seconds Seconds since service started",
        "# TYPE meshsegnet_uptime_seconds gauge",
        f"meshsegnet_uptime_seconds {uptime}",
        "# HELP meshsegnet_requests_total Total segmentation requests",
        "# TYPE meshsegnet_requests_total counter",
        f"meshsegnet_requests_total {_counters['requests_total']}",
        "# HELP meshsegnet_successes_total Completed segmentations",
        "# TYPE meshsegnet_successes_total counter",
        f"meshsegnet_successes_total {_counters['successes_total']}",
        "# HELP meshsegnet_failures_total Failed segmentations",
        "# TYPE meshsegnet_failures_total counter",
        f"meshsegnet_failures_total {_counters['failures_total']}",
        "# HELP meshsegnet_manual_review_total Segmentations flagged for review",
        "# TYPE meshsegnet_manual_review_total counter",
        f"meshsegnet_manual_review_total {_counters['manual_review_total']}",
        "",
    ]
    return "\n".join(lines)


# ── Job lifecycle helpers ─────────────────────────────────────────────────────

def _new_job(jaw: str, scan_id: str, source: str) -> tuple[str, dict]:
    job_id = str(uuid.uuid4())
    job = {
        "job_id": job_id,
        "status": "queued",
        "jaw": jaw,
        "scan_id": scan_id,
        "source": source,
        "created_at": time.time(),
        "updated_at": time.time(),
        "error": None,
        "research_use": True,
        "disclaimer": CLINICAL_DISCLAIMER,
    }
    _jobs[job_id] = job
    return job_id, job


def _update_job(job_id: str, **kwargs) -> None:
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)
        _jobs[job_id]["updated_at"] = time.time()


# ── Core inference ────────────────────────────────────────────────────────────

def _run_inference(file_path: str, jaw: str, job_id: str) -> None:
    """Run MeshSegNet inference in the calling thread (called from background task)."""
    t0 = time.perf_counter()
    _counters["requests_total"] += 1
    _update_job(job_id, status="preprocessing")

    try:
        # Load mesh
        mesh = trimesh.load(file_path, process=False, force="mesh")
        if not hasattr(mesh, "faces") or len(mesh.faces) == 0:
            raise ValueError("Loaded mesh has no faces")

        vertices = np.array(mesh.vertices, dtype=np.float32)
        faces = np.array(mesh.faces, dtype=np.int64)
        N_faces = len(faces)
        logger.info("Loaded mesh: %d vertices, %d faces", len(vertices), N_faces)

        _update_job(job_id, status="running", face_count=int(N_faces))

        # Feature extraction
        features, adj = extract_features(vertices, faces, K=6)

        # Inference
        x = torch.from_numpy(features).to(_device)        # [N, 15]
        a = torch.from_numpy(adj).to(_device)              # [N, 6]

        assert _model is not None
        with torch.no_grad():
            log_probs = _model(x, a)                       # [N, 17]
            probs = torch.exp(log_probs)                   # [N, 17]

        # Per-face predicted class and max probability
        max_probs, raw_labels = probs.max(dim=1)           # [N], [N]
        raw_labels_list: List[int] = raw_labels.cpu().tolist()
        max_probs_list: List[float] = max_probs.cpu().tolist()

        _update_job(job_id, status="validating")

        # Convert to FDI labels
        fdi_labels: List[int] = class_labels_to_fdi(raw_labels_list, jaw)

        # Per-tooth confidence from softmax probabilities
        confidence_scores = compute_per_face_softmax_confidence(fdi_labels, max_probs_list)

        # FDI validation
        validation = validate_fdi_sequence(
            fdi_labels,
            jaw,
            confidence_scores=confidence_scores,
            confidence_threshold=CONFIDENCE_THRESHOLD,
        )

        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        # Vertex labels (aggregate per-face label → per-vertex by majority vote)
        vertex_labels = _face_to_vertex_labels(fdi_labels, faces, len(vertices))
        vertex_instances = list(range(len(vertex_labels)))  # MeshSegNet has no instance ID

        # Build result
        result = {
            "status": "completed",
            "tooth_ids": validation.detected_teeth,
            "missing_teeth": validation.missing_teeth,
            "confidence_scores": validation.confidence_scores,
            "confidence_maps": validation.confidence_scores,
            "fdi_valid": validation.is_valid,
            "requires_manual_review": validation.requires_manual_review,
            "deciduous_detected": validation.deciduous_detected,
            "warnings": validation.warnings,
            "vertex_labels": vertex_labels,
            "vertex_instances": vertex_instances,
            "weights_loaded": True,
            "timing_ms": elapsed_ms,
            "engine": "meshsegnet",
            "engine_version": MODEL_VERSION,
            "research_use": True,
            "disclaimer": CLINICAL_DISCLAIMER,
        }
        _update_job(job_id, **result)

        _counters["successes_total"] += 1
        _counters["duration_ms_sum"] += elapsed_ms
        _counters["duration_ms_count"] += 1
        if validation.requires_manual_review:
            _counters["manual_review_total"] += 1
        if not validation.is_valid:
            _counters["validation_failures_total"] += 1

        logger.info(
            "Job %s completed: %d teeth, %d ms, manual_review=%s",
            job_id, len(validation.detected_teeth), elapsed_ms,
            validation.requires_manual_review,
        )

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        _counters["failures_total"] += 1
        _update_job(job_id, status="failed", error=str(exc))
        logger.error("Job %s failed: %s", job_id, exc)


def _face_to_vertex_labels(
    face_labels: List[int],
    faces: np.ndarray,
    n_vertices: int,
) -> List[int]:
    """
    Assign per-vertex labels by majority vote over incident face labels.
    Vertices with no incident labeled face default to 0 (gingiva).
    """
    from collections import Counter
    vote: Dict[int, Counter] = {}
    for fdi_label, face in zip(face_labels, faces):
        for v in face:
            v = int(v)
            if v not in vote:
                vote[v] = Counter()
            vote[v][fdi_label] += 1
    result = [0] * n_vertices
    for v, counter in vote.items():
        result[v] = counter.most_common(1)[0][0]
    return result


# ── Request/response models ───────────────────────────────────────────────────

class ByPathRequest(BaseModel):
    file_path: str
    jaw: str = "auto"
    scan_id: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/segment/by-path")
def segment_by_path(
    req: ByPathRequest,
    x_internal_token: Optional[str] = Header(default=None),
) -> dict:
    _require_internal_token(x_internal_token)

    if _state != MeshSegNetState.READY:
        raise HTTPException(status_code=503, detail=f"MeshSegNet not ready: {_state.value}")

    if not os.path.isfile(req.file_path):
        raise HTTPException(status_code=400, detail=f"File not found: {req.file_path}")

    jaw = _normalise_jaw(req.jaw)
    scan_id = req.scan_id or os.path.splitext(os.path.basename(req.file_path))[0]
    job_id, _ = _new_job(jaw, scan_id, "by-path")

    import threading
    t = threading.Thread(target=_run_inference, args=(req.file_path, jaw, job_id), daemon=True)
    t.start()

    return {"job_id": job_id, "status": "queued"}


@app.post("/segment")
async def segment_upload(
    file: UploadFile = File(...),
    jaw: str = Form("auto"),
    scan_id: Optional[str] = Form(default=None),
    x_internal_token: Optional[str] = Header(default=None),
) -> dict:
    _require_internal_token(x_internal_token)

    if _state != MeshSegNetState.READY:
        raise HTTPException(status_code=503, detail=f"MeshSegNet not ready: {_state.value}")

    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Upload exceeds limit of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )

    suffix = os.path.splitext(file.filename or ".obj")[1] or ".obj"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(raw)
    tmp.close()

    j_jaw = _normalise_jaw(jaw)
    j_scan_id = scan_id or os.path.splitext(file.filename or "scan")[0]
    job_id, _ = _new_job(j_jaw, j_scan_id, "upload")

    import threading

    def _run_and_cleanup(path: str, jaw_: str, jid: str) -> None:
        try:
            _run_inference(path, jaw_, jid)
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

    t = threading.Thread(target=_run_and_cleanup, args=(tmp.name, j_jaw, job_id), daemon=True)
    t.start()

    return {"job_id": job_id, "status": "queued"}


@app.get("/jobs/{job_id}")
def get_job(
    job_id: str,
    x_internal_token: Optional[str] = Header(default=None),
) -> dict:
    _require_internal_token(x_internal_token)
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


# ── Jaw normalisation ─────────────────────────────────────────────────────────

def _normalise_jaw(jaw: str) -> str:
    j = jaw.lower().strip()
    if j in ("maxillary", "upper", "max"):
        return "upper"
    if j in ("mandibular", "lower", "mand"):
        return "lower"
    if j in ("combined", "both", "full"):
        return "combined"
    return "upper"  # default


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8002, reload=False)
