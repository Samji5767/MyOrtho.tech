"""
ToothGroupNetwork FastAPI microservice.

Wraps TGN point-cloud inference with:
  - Async job queue (Redis-backed, in-memory fallback)
  - STL → OBJ conversion (Phase 3 preprocessing)
  - FDI validation (Phase 5)
  - Health, readiness, and metrics endpoints
  - Structured JSON logging
  - Graceful shutdown
  - GPU/CPU auto-detection

Endpoints (all except /health and /ready require X-Internal-Token):
  POST /segment           — upload or reference a file, start async job
  GET  /jobs/{job_id}     — poll job status and results
  GET  /health            — liveness probe
  GET  /ready             — readiness probe (reports model & device)
  GET  /metrics           — simple operation counters

AI disclaimer:
  All outputs from this service are AI-assisted and require review
  by a licensed orthodontist before any clinical decision is made.
"""

import asyncio
import json
import logging
import os
import shutil
import sys
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import redis as redis_lib
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","svc":"tgn-api","level":"%(levelname)s","msg":"%(message)s"}',
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
logger = logging.getLogger("tgn-api")

# ── Configuration ─────────────────────────────────────────────────────────────

CHECKPOINT_FPS = os.getenv("TGNET_FPS_CHECKPOINT", "/ckpts/tgnet_fps.h5")
CHECKPOINT_BDL = os.getenv("TGNET_BDL_CHECKPOINT", "/ckpts/tgnet_bdl.h5")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_SECRET", "")
MODEL_NAME = os.getenv("TGN_MODEL_NAME", "tgnet_fps")
INFERENCE_TIMEOUT = int(os.getenv("TGN_TIMEOUT_SEC", "300"))
UPLOAD_DIR = os.getenv("TGN_UPLOAD_DIR", "/tmp/tgn_uploads")
JOB_TTL = 86_400 * 7  # 7 days
VERSION = "1.0.0"
CLINICAL_DISCLAIMER = (
    "AI-assisted recommendation only. "
    "Final treatment decisions remain the responsibility of the licensed orthodontist."
)

# ── Metrics ───────────────────────────────────────────────────────────────────

_metrics: Dict[str, int] = {
    "jobs_queued": 0,
    "jobs_completed": 0,
    "jobs_failed": 0,
    "total_inference_ms": 0,
}

# ── Model globals ─────────────────────────────────────────────────────────────

_scan_segmentation: Optional[Any] = None
_model_loaded = False
_model_error: Optional[str] = None

# ── Redis ──────────────────────────────────────────────────────────────────────

_redis: Optional[Any] = None
_job_store: Dict[str, Dict] = {}  # in-memory fallback

# ── Thread pool ───────────────────────────────────────────────────────────────

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="tgn-worker")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _job_set(job_id: str, data: Dict) -> None:
    if _redis:
        try:
            _redis.setex(f"tgn:job:{job_id}", JOB_TTL, json.dumps(data))
            return
        except Exception:
            pass
    _job_store[job_id] = data


def _job_get(job_id: str) -> Optional[Dict]:
    if _redis:
        try:
            raw = _redis.get(f"tgn:job:{job_id}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return _job_store.get(job_id)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Model loading ─────────────────────────────────────────────────────────────

def _load_model() -> bool:
    """
    Import TGN modules and initialise the inference pipeline.
    Applies cpu_compat patches for CPU inference.
    Returns True on success, False on failure (model not available).
    """
    global _scan_segmentation, _model_loaded, _model_error

    # TGN paths — populated by the container's PYTHONPATH / COPY instructions
    tgn_root = "/app/ToothGroupNetwork"
    ext_libs = "/app/ToothGroupNetwork/external_libs"
    patches_dir = "/app"  # contains cpu_compat.py

    for p in [tgn_root, ext_libs, patches_dir]:
        if p not in sys.path:
            sys.path.insert(0, p)

    # Apply CPU compat patches first
    try:
        import cpu_compat  # noqa: F401
        logger.info("cpu_compat patches applied")
    except ImportError as exc:
        logger.warning("cpu_compat not found (%s); running without patches (GPU only)", exc)

    # Check checkpoints
    for ckpt, name in [(CHECKPOINT_FPS, "FPS"), (CHECKPOINT_BDL, "BDL")]:
        if not os.path.isfile(ckpt):
            _model_error = (
                f"Checkpoint missing: {ckpt}. "
                "Download from https://drive.google.com/drive/folders/15oP0CZM_O_-Bir18VbSM8wRUEzoyLXby"
            )
            logger.error(_model_error)
            return False

    # Load pipeline
    try:
        from inference_pipelines.inference_pipeline_maker import make_inference_pipeline
        from predict_utils import ScanSegmentation

        pipeline = make_inference_pipeline(
            MODEL_NAME,
            [CHECKPOINT_FPS, CHECKPOINT_BDL],
        )
        _scan_segmentation = ScanSegmentation(pipeline)
        _model_loaded = True
        logger.info("TGN model loaded: %s | FPS=%s | BDL=%s", MODEL_NAME, CHECKPOINT_FPS, CHECKPOINT_BDL)
        return True

    except Exception as exc:
        _model_error = f"Model load failed: {exc}"
        logger.error(_model_error)
        return False


# ── STL preprocessing integration ────────────────────────────────────────────

def _ensure_obj(file_path: str, scan_id: str, jaw: str) -> str:
    """
    Return an OBJ path for inference.  If input is STL/PLY/OFF, convert first.
    Raises ValueError on conversion failure.
    """
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".obj":
        return file_path

    # Need conversion
    sys.path.insert(0, "/opt/toothgroupnetwork")
    try:
        from preprocessing.stl_to_obj import convert_stl_to_obj
    except ImportError:
        # Fallback: try trimesh direct export
        import trimesh
        mesh = trimesh.load(file_path, process=False, force="mesh")
        obj_path = file_path.replace(ext, ".obj")
        mesh.export(obj_path, file_type="obj", include_normals=True)
        return obj_path

    obj_path = os.path.splitext(file_path)[0] + f"_{jaw}.obj"
    result = convert_stl_to_obj(file_path, obj_path)
    if not result.success:
        raise ValueError(f"Preprocessing failed: {result.error}")
    return result.output_path


# ── Inference task ─────────────────────────────────────────────────────────────

def _run_inference_sync(job_id: str, file_path: str, jaw: str, scan_id: str) -> None:
    """
    Synchronous inference worker (runs in thread pool).
    Updates job store on completion or failure.
    """
    import collections as _col
    from api.fdi_validator import compute_per_tooth_confidence, validate_fdi_sequence

    t0 = time.monotonic()
    working_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(working_dir, exist_ok=True)

    try:
        # ── Preprocessing ─────────────────────────────────────────────────────
        jaw_norm = jaw.lower()
        if jaw_norm in ("maxillary", "upper", "max"):
            tgn_jaw = "upper"
        elif jaw_norm in ("mandibular", "lower", "mand"):
            tgn_jaw = "lower"
        else:
            raise ValueError(f"Invalid jaw: '{jaw}'. Use 'upper'/'maxillary' or 'lower'/'mandibular'.")

        obj_path = _ensure_obj(file_path, scan_id, tgn_jaw)

        # TGN expects:  {input_dir}/{scan_id}/{scan_id}_{jaw}.obj
        tgn_input = os.path.join(working_dir, "input")
        scan_subdir = os.path.join(tgn_input, scan_id)
        os.makedirs(scan_subdir, exist_ok=True)
        obj_name = f"{scan_id}_{tgn_jaw}.obj"
        dest_obj = os.path.join(scan_subdir, obj_name)
        if not os.path.isfile(dest_obj):
            shutil.copy2(obj_path, dest_obj)

        tgn_output = os.path.join(working_dir, "output")
        os.makedirs(tgn_output, exist_ok=True)

        output_json = os.path.join(tgn_output, obj_name.replace(".obj", ".json"))

        # ── Inference ─────────────────────────────────────────────────────────
        if not _model_loaded or _scan_segmentation is None:
            raise RuntimeError(
                f"Model not loaded: {_model_error or 'checkpoints not configured'}"
            )

        _scan_segmentation.process(dest_obj, output_json)

        # ── Parse output ──────────────────────────────────────────────────────
        with open(output_json) as fh:
            seg = json.load(fh)

        labels: List[int] = seg.get("labels", [])
        instances: List[int] = seg.get("instances", [])
        seg_jaw: str = seg.get("jaw", tgn_jaw)

        # FDI confidence + validation
        confidence = compute_per_tooth_confidence(labels, instances)
        validation = validate_fdi_sequence(labels, seg_jaw, confidence)

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        _metrics["jobs_completed"] += 1
        _metrics["total_inference_ms"] += elapsed_ms

        _job_set(
            job_id,
            {
                "status": "completed",
                "job_id": job_id,
                "scan_id": scan_id,
                "jaw": seg_jaw,
                "tooth_ids": validation.detected_teeth,
                "missing_teeth": validation.missing_teeth,
                "unexpected_teeth": validation.unexpected_teeth,
                "low_confidence_teeth": validation.low_confidence_teeth,
                "confidence_scores": validation.confidence_scores,
                "fdi_valid": validation.is_valid,
                "requires_manual_review": validation.requires_manual_review,
                "deciduous_detected": validation.deciduous_detected,
                "warnings": validation.warnings,
                "vertex_labels": labels,
                "vertex_instances": instances,
                "timing_ms": elapsed_ms,
                "completed_at": _now(),
                "disclaimer": CLINICAL_DISCLAIMER,
            },
        )
        logger.info("Job %s completed: %d teeth in %dms", job_id, len(validation.detected_teeth), elapsed_ms)

    except Exception as exc:
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        _metrics["jobs_failed"] += 1
        error_msg = str(exc)
        _job_set(
            job_id,
            {
                "status": "failed",
                "job_id": job_id,
                "scan_id": scan_id,
                "error": error_msg,
                "timing_ms": elapsed_ms,
                "failed_at": _now(),
            },
        )
        logger.error("Job %s failed after %dms: %s", job_id, elapsed_ms, error_msg)
    finally:
        # Clean up working dir (keep output JSON for debugging)
        try:
            input_dir = os.path.join(working_dir, "input")
            if os.path.isdir(input_dir):
                shutil.rmtree(input_dir, ignore_errors=True)
        except Exception:
            pass


async def _run_inference_async(job_id: str, file_path: str, jaw: str, scan_id: str) -> None:
    loop = asyncio.get_event_loop()
    try:
        await asyncio.wait_for(
            loop.run_in_executor(
                _executor,
                lambda: _run_inference_sync(job_id, file_path, jaw, scan_id),
            ),
            timeout=float(INFERENCE_TIMEOUT),
        )
    except asyncio.TimeoutError:
        _metrics["jobs_failed"] += 1
        _job_set(
            job_id,
            {
                "status": "failed",
                "job_id": job_id,
                "error": f"Inference timed out after {INFERENCE_TIMEOUT}s",
                "failed_at": _now(),
            },
        )
        logger.error("Job %s timed out after %ds", job_id, INFERENCE_TIMEOUT)


# ── Auth dependency ───────────────────────────────────────────────────────────

def _require_token(request: Request) -> None:
    if not INTERNAL_TOKEN:
        return  # token checking disabled when env var not set
    token = request.headers.get("X-Internal-Token", "")
    if token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Token")


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(application: FastAPI):
    global _redis
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Redis
    try:
        _redis = redis_lib.Redis.from_url(
            REDIS_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        _redis.ping()
        logger.info("Connected to Redis at %s", REDIS_URL)
    except Exception as exc:
        _redis = None
        logger.warning("Redis unavailable (%s); using in-memory job store", exc)

    # Model warm-up
    loop = asyncio.get_event_loop()
    loaded = await loop.run_in_executor(_executor, _load_model)
    if loaded:
        logger.info("TGN model warm-up complete")
    else:
        logger.warning("TGN model not available — %s", _model_error)

    yield

    # Graceful shutdown
    _executor.shutdown(wait=False)
    logger.info("TGN API shut down")


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="ToothGroupNetwork Segmentation API",
    description=(
        "3D dental tooth segmentation microservice (MICCAI 2022 Winner). "
        f"{CLINICAL_DISCLAIMER}"
    ),
    version=VERSION,
    lifespan=lifespan,
)

# ── Request models ────────────────────────────────────────────────────────────


class SegmentByPathRequest(BaseModel):
    file_path: str
    jaw: str  # "upper" / "maxillary" | "lower" / "mandibular"
    scan_id: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "tgn-api",
        "version": VERSION,
        "timestamp": _now(),
    }


@app.get("/ready")
async def ready():
    import torch
    cuda = torch.cuda.is_available()
    return {
        "ready": True,
        "model_loaded": _model_loaded,
        "model_error": _model_error,
        "device": "cuda" if cuda else "cpu",
        "gpu_acceleration": cuda,
        "model_name": MODEL_NAME,
        "checkpoint_fps": CHECKPOINT_FPS,
        "checkpoint_bdl": CHECKPOINT_BDL,
        "disclaimer": CLINICAL_DISCLAIMER,
    }


@app.get("/metrics")
async def metrics(request: Request, _: None = Depends(_require_token)):
    return {
        "jobs_queued": _metrics["jobs_queued"],
        "jobs_completed": _metrics["jobs_completed"],
        "jobs_failed": _metrics["jobs_failed"],
        "mean_inference_ms": (
            int(_metrics["total_inference_ms"] / _metrics["jobs_completed"])
            if _metrics["jobs_completed"] > 0
            else 0
        ),
    }


@app.post("/segment", dependencies=[Depends(_require_token)])
async def segment_file(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    jaw: str = Form("auto"),
    scan_id: Optional[str] = Form(None),
):
    """
    Submit a segmentation job via multipart file upload.

    Accepts STL, OBJ, PLY, or OFF.  The file is saved to UPLOAD_DIR, then
    TGN inference runs asynchronously.  Poll /jobs/{job_id} for status.
    """
    if file is None:
        raise HTTPException(status_code=400, detail="file field is required")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in {".stl", ".obj", ".ply", ".off"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: .stl .obj .ply .off",
        )

    job_id = str(uuid.uuid4())
    _sid = scan_id or job_id[:8]

    # Save upload
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    saved_path = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")
    with open(saved_path, "wb") as fh:
        content = await file.read()
        fh.write(content)

    _metrics["jobs_queued"] += 1
    _job_set(
        job_id,
        {
            "status": "queued",
            "job_id": job_id,
            "scan_id": _sid,
            "jaw": jaw,
            "queued_at": _now(),
        },
    )

    background_tasks.add_task(_run_inference_async, job_id, saved_path, jaw, _sid)

    return {
        "job_id": job_id,
        "status": "queued",
        "message": f"Segmentation job queued. Poll /jobs/{job_id} for results.",
        "disclaimer": CLINICAL_DISCLAIMER,
    }


@app.post("/segment/by-path", dependencies=[Depends(_require_token)])
async def segment_by_path(
    req: SegmentByPathRequest,
    background_tasks: BackgroundTasks,
):
    """
    Submit a segmentation job referencing a file already on shared storage.

    Used by the MyOrtho ai-engine when files are accessible via a shared volume.
    """
    if not os.path.isfile(req.file_path):
        raise HTTPException(
            status_code=400,
            detail=f"File not found: {req.file_path}",
        )

    job_id = str(uuid.uuid4())
    _sid = req.scan_id or job_id[:8]

    _metrics["jobs_queued"] += 1
    _job_set(
        job_id,
        {
            "status": "queued",
            "job_id": job_id,
            "scan_id": _sid,
            "jaw": req.jaw,
            "file_path": req.file_path,
            "queued_at": _now(),
        },
    )

    background_tasks.add_task(_run_inference_async, job_id, req.file_path, req.jaw, _sid)

    return {
        "job_id": job_id,
        "status": "queued",
        "message": f"Segmentation job queued. Poll /jobs/{job_id} for results.",
        "disclaimer": CLINICAL_DISCLAIMER,
    }


@app.get("/jobs/{job_id}", dependencies=[Depends(_require_token)])
async def get_job(job_id: str):
    job = _job_get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found (expires after 7 days).",
        )
    return job
