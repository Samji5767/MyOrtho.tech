"""
ToothGroupNetwork FastAPI microservice.

Wraps TGN point-cloud inference with:
  - Async job queue (Redis-backed, in-memory fallback)
  - STL → OBJ conversion (Phase 3 preprocessing)
  - FDI validation (Phase 5)
  - Health, readiness, and metrics endpoints
  - Structured JSON logging with request correlation IDs
  - Graceful shutdown
  - GPU/CPU auto-detection
  - SHA-256 checkpoint integrity verification
  - Fail-closed authentication

TGN_ENABLED must be set to "true" (case-insensitive) to activate inference.
When TGN_ENABLED is false or unset the service starts but rejects /segment requests.

Endpoints (all except /health and /ready require X-Internal-Token):
  POST /segment           — upload or reference a file, start async job
  GET  /jobs/{job_id}     — poll job status and results
  GET  /health            — liveness probe
  GET  /ready             — readiness probe (reports model & device)
  GET  /metrics           — operation counters

Research use only:
  This service is research-grade software. All outputs must be reviewed
  by a licensed orthodontist before any clinical decision is made.
  Not cleared as Software as a Medical Device (SaMD) by any regulatory body.
"""

import asyncio
import hashlib
import hmac
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
from enum import Enum
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
CHECKPOINT_SHA256_FPS = os.getenv("CHECKPOINT_SHA256_FPS", "").strip()
CHECKPOINT_SHA256_BDL = os.getenv("CHECKPOINT_SHA256_BDL", "").strip()
REQUIRE_CHECKSUM = os.getenv("REQUIRE_CHECKSUM", "false").lower() in ("1", "true", "yes")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_SECRET", "").strip()
MODEL_NAME = os.getenv("TGN_MODEL_NAME", "tgnet_fps")
MODEL_VERSION = os.getenv("TGN_MODEL_VERSION", "1.0.0")
INFERENCE_TIMEOUT = int(os.getenv("TGN_TIMEOUT_SEC", "300"))
UPLOAD_DIR = os.getenv("TGN_UPLOAD_DIR", "/tmp/tgn_uploads")
TGN_ENABLED = os.getenv("TGN_ENABLED", "false").lower() in ("1", "true", "yes")

# Allowed directories for /segment/by-path (colon-separated)
_ALLOWED_PATH_DIRS_RAW = os.getenv("TGN_ALLOWED_PATH_DIRS", "/app/uploads:/tmp/tgn_uploads")
ALLOWED_PATH_DIRS = [
    os.path.realpath(d.strip()) for d in _ALLOWED_PATH_DIRS_RAW.split(":") if d.strip()
]

JOB_TTL = 86_400 * 7  # 7 days
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB — matches ai-engine limit
VERSION = "1.1.0"

CLINICAL_DISCLAIMER = (
    "AI-assisted recommendation only. "
    "Final treatment decisions remain the responsibility of the licensed orthodontist."
)
RESEARCH_USE_NOTICE = (
    "Research-use segmentation. Manual clinical review required. "
    "Not cleared as a Software as a Medical Device."
)


# ── Model state ───────────────────────────────────────────────────────────────

class ModelState(str, Enum):
    unavailable = "unavailable"   # checkpoints missing or TGN_ENABLED=false
    loading = "loading"           # warm-up in progress
    ready = "ready"               # model loaded, inference available
    failed = "failed"             # load attempted but failed

_model_state: ModelState = ModelState.unavailable
_model_error: Optional[str] = None
_scan_segmentation: Optional[Any] = None
_checkpoint_sha256: Dict[str, str] = {}  # {"fps": "abc123...", "bdl": "def456..."}


# ── Metrics ───────────────────────────────────────────────────────────────────

_metrics: Dict[str, int] = {
    "jobs_queued": 0,
    "jobs_completed": 0,
    "jobs_failed": 0,
    "total_inference_ms": 0,
}

# ── Redis / job store ─────────────────────────────────────────────────────────

_redis: Optional[Any] = None
_job_store: Dict[str, Dict] = {}

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


def _sha256_file(path: str) -> str:
    """Compute SHA-256 of a file; returns hex digest."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _assert_safe_path(file_path: str) -> str:
    """
    Validate that file_path resolves within an allowed directory.
    Raises ValueError on traversal or access outside allowed dirs.
    Returns the realpath.
    """
    try:
        real = os.path.realpath(file_path)
    except Exception:
        raise ValueError(f"Cannot resolve path: {file_path}")

    for allowed in ALLOWED_PATH_DIRS:
        if real.startswith(allowed + os.sep) or real == allowed:
            return real

    raise ValueError(
        f"File path is outside allowed directories. "
        f"Allowed: {ALLOWED_PATH_DIRS}"
    )


# ── Checkpoint verification ───────────────────────────────────────────────────

def _verify_checkpoint(path: str, expected_sha256: str, name: str) -> bool:
    """
    Verify checkpoint integrity.
    - If expected_sha256 is set: compute file hash and compare; fail-closed on mismatch.
    - If expected_sha256 is empty and REQUIRE_CHECKSUM=true: reject (fail-closed).
    - If expected_sha256 is empty and REQUIRE_CHECKSUM=false: warn and accept.
    Returns True on pass, False on fail.
    """
    actual = _sha256_file(path)
    prefix = actual[:16]
    logger.info("Checkpoint %s SHA-256: %s… (%s)", name, prefix, path)

    if expected_sha256:
        if not hmac.compare_digest(actual.lower(), expected_sha256.lower()):
            logger.error(
                "CHECKSUM MISMATCH for %s: expected=%s… got=%s",
                name, expected_sha256[:16], prefix,
            )
            return False
        logger.info("Checkpoint %s checksum verified ✓", name)
    elif REQUIRE_CHECKSUM:
        logger.error(
            "REQUIRE_CHECKSUM=true but no expected hash set for %s. Refusing to load.",
            name,
        )
        return False
    else:
        logger.warning(
            "No expected SHA-256 for %s — checksum not verified. "
            "Set CHECKPOINT_SHA256_%s to enable integrity check.",
            name, name.upper(),
        )

    return True


# ── Model loading ─────────────────────────────────────────────────────────────

def _load_model() -> bool:
    """
    Import TGN modules and initialise the inference pipeline.
    Verifies checkpoint integrity before loading.
    Returns True on success, False on failure.
    """
    global _scan_segmentation, _model_state, _model_error, _checkpoint_sha256

    if not TGN_ENABLED:
        _model_state = ModelState.unavailable
        _model_error = "TGN_ENABLED is not set to true. Inference disabled."
        logger.info("TGN inference disabled (TGN_ENABLED != true)")
        return False

    _model_state = ModelState.loading

    # TGN paths — populated by the container's PYTHONPATH / COPY instructions
    tgn_root = "/app/ToothGroupNetwork"
    ext_libs = "/app/ToothGroupNetwork/external_libs"
    patches_dir = "/app"

    for p in [tgn_root, ext_libs, patches_dir]:
        if p not in sys.path:
            sys.path.insert(0, p)

    # Apply CPU compat patches first
    try:
        import cpu_compat  # noqa: F401
        logger.info("cpu_compat patches applied")
    except ImportError as exc:
        logger.warning("cpu_compat not found (%s); running without patches (GPU only)", exc)

    # Check checkpoints exist
    for ckpt, name in [(CHECKPOINT_FPS, "FPS"), (CHECKPOINT_BDL, "BDL")]:
        if not os.path.isfile(ckpt):
            _model_state = ModelState.unavailable
            _model_error = (
                f"Checkpoint missing: {ckpt}. "
                "Run scripts/download_checkpoints.sh to download."
            )
            logger.error(_model_error)
            return False

    # Verify checksums
    fps_ok = _verify_checkpoint(CHECKPOINT_FPS, CHECKPOINT_SHA256_FPS, "FPS")
    bdl_ok = _verify_checkpoint(CHECKPOINT_BDL, CHECKPOINT_SHA256_BDL, "BDL")
    if not fps_ok or not bdl_ok:
        _model_state = ModelState.failed
        _model_error = "Checkpoint integrity verification failed. Refusing to load model."
        logger.error(_model_error)
        return False

    _checkpoint_sha256 = {
        "fps": _sha256_file(CHECKPOINT_FPS),
        "bdl": _sha256_file(CHECKPOINT_BDL),
    }

    # Load pipeline
    try:
        from inference_pipelines.inference_pipeline_maker import make_inference_pipeline
        from predict_utils import ScanSegmentation

        pipeline = make_inference_pipeline(
            MODEL_NAME,
            [CHECKPOINT_FPS, CHECKPOINT_BDL],
        )
        _scan_segmentation = ScanSegmentation(pipeline)
        _model_state = ModelState.ready
        logger.info(
            "TGN model ready | name=%s version=%s | FPS=%s…| BDL=%s…",
            MODEL_NAME, MODEL_VERSION,
            _checkpoint_sha256["fps"][:16],
            _checkpoint_sha256["bdl"][:16],
        )
        return True

    except Exception as exc:
        _model_state = ModelState.failed
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

    sys.path.insert(0, "/opt/toothgroupnetwork")
    try:
        from preprocessing.stl_to_obj import convert_stl_to_obj
    except ImportError:
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

def _run_inference_sync(
    job_id: str, file_path: str, jaw: str, scan_id: str, request_id: str
) -> None:
    """Synchronous inference worker (runs in thread pool)."""
    from api.fdi_validator import compute_per_tooth_confidence, validate_fdi_sequence

    t0 = time.monotonic()
    working_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(working_dir, exist_ok=True)

    try:
        # Update status to preprocessing
        existing = _job_get(job_id) or {}
        existing["status"] = "preprocessing"
        _job_set(job_id, existing)

        jaw_norm = jaw.lower()
        if jaw_norm in ("maxillary", "upper", "max"):
            tgn_jaw = "upper"
        elif jaw_norm in ("mandibular", "lower", "mand"):
            tgn_jaw = "lower"
        else:
            raise ValueError(f"Invalid jaw: '{jaw}'. Use 'upper'/'maxillary' or 'lower'/'mandibular'.")

        obj_path = _ensure_obj(file_path, scan_id, tgn_jaw)

        # TGN expects: {input_dir}/{scan_id}/{scan_id}_{jaw}.obj
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

        # Update status to running
        existing = _job_get(job_id) or {}
        existing["status"] = "running"
        _job_set(job_id, existing)

        if _model_state != ModelState.ready or _scan_segmentation is None:
            raise RuntimeError(
                f"Model not ready (state={_model_state.value}): "
                f"{_model_error or 'checkpoints not configured'}"
            )

        _scan_segmentation.process(dest_obj, output_json)

        # Update status to validating
        existing = _job_get(job_id) or {}
        existing["status"] = "validating"
        _job_set(job_id, existing)

        # Parse output
        with open(output_json) as fh:
            seg = json.load(fh)

        labels: List[int] = seg.get("labels", [])
        instances: List[int] = seg.get("instances", [])
        seg_jaw: str = seg.get("jaw", tgn_jaw)

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
                "request_id": request_id,
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
                "model_name": MODEL_NAME,
                "model_version": MODEL_VERSION,
                "checkpoint_sha256_fps": _checkpoint_sha256.get("fps", "")[:16] or None,
                "checkpoint_sha256_bdl": _checkpoint_sha256.get("bdl", "")[:16] or None,
                "research_use": True,
                "research_use_notice": RESEARCH_USE_NOTICE,
                "disclaimer": CLINICAL_DISCLAIMER,
            },
        )
        logger.info(
            "Job %s completed: %d teeth in %dms | req=%s",
            job_id, len(validation.detected_teeth), elapsed_ms, request_id,
        )

    except Exception as exc:
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        _metrics["jobs_failed"] += 1
        error_msg = str(exc)
        _job_set(
            job_id,
            {
                "status": "failed",
                "job_id": job_id,
                "request_id": request_id,
                "scan_id": scan_id,
                "error": error_msg,
                "timing_ms": elapsed_ms,
                "failed_at": _now(),
                "research_use": True,
            },
        )
        logger.error("Job %s failed after %dms: %s | req=%s", job_id, elapsed_ms, error_msg, request_id)
    finally:
        # Delete uploaded source file and input working dir; keep output JSON for debugging
        try:
            if os.path.isfile(file_path):
                os.unlink(file_path)
        except Exception:
            pass
        try:
            input_dir = os.path.join(working_dir, "input")
            if os.path.isdir(input_dir):
                shutil.rmtree(input_dir, ignore_errors=True)
        except Exception:
            pass


async def _run_inference_async(
    job_id: str, file_path: str, jaw: str, scan_id: str, request_id: str
) -> None:
    loop = asyncio.get_event_loop()
    try:
        await asyncio.wait_for(
            loop.run_in_executor(
                _executor,
                lambda: _run_inference_sync(job_id, file_path, jaw, scan_id, request_id),
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
                "request_id": request_id,
                "error": f"Inference timed out after {INFERENCE_TIMEOUT}s",
                "failed_at": _now(),
                "research_use": True,
            },
        )
        logger.error("Job %s timed out after %ds | req=%s", job_id, INFERENCE_TIMEOUT, request_id)


# ── Auth dependency ───────────────────────────────────────────────────────────

def _require_token(request: Request) -> None:
    """
    Fail-closed token authentication.
    - If INTERNAL_API_SECRET is not set: reject all requests (do not allow open access).
    - Uses hmac.compare_digest to prevent timing attacks.
    """
    if not INTERNAL_TOKEN:
        raise HTTPException(
            status_code=503,
            detail=(
                "Service not configured: INTERNAL_API_SECRET is not set. "
                "Set this environment variable before sending authenticated requests."
            ),
        )
    token = request.headers.get("X-Internal-Token", "")
    if not hmac.compare_digest(token.encode(), INTERNAL_TOKEN.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Token")


# ── Request ID middleware ─────────────────────────────────────────────────────

def _get_request_id(request: Request) -> str:
    return request.headers.get("X-Request-ID") or str(uuid.uuid4())


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(application: FastAPI):
    global _redis
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    logger.info(
        "TGN API starting | version=%s model=%s enabled=%s",
        VERSION, MODEL_NAME, TGN_ENABLED,
    )

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

    # Auth check
    if not INTERNAL_TOKEN:
        logger.warning(
            "INTERNAL_API_SECRET is not set — all authenticated endpoints will return 503. "
            "Set this variable before accepting inference requests."
        )

    # Path whitelist log
    logger.info("Allowed path dirs for by-path: %s", ALLOWED_PATH_DIRS)

    # Model warm-up
    loop = asyncio.get_event_loop()
    loaded = await loop.run_in_executor(_executor, _load_model)
    if loaded:
        logger.info(
            "TGN model warm-up complete | state=%s | fps_sha256=%s… | bdl_sha256=%s…",
            _model_state.value,
            _checkpoint_sha256.get("fps", "")[:16],
            _checkpoint_sha256.get("bdl", "")[:16],
        )
    else:
        logger.warning("TGN model not available — state=%s | %s", _model_state.value, _model_error)

    yield

    # Graceful shutdown
    _executor.shutdown(wait=False)
    logger.info("TGN API shut down")


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="ToothGroupNetwork Segmentation API",
    description=(
        "3D dental tooth segmentation microservice (MICCAI 2022 Winner). "
        f"Research use only. {CLINICAL_DISCLAIMER}"
    ),
    version=VERSION,
    lifespan=lifespan,
)


# ── Request ID middleware ─────────────────────────────────────────────────────

@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request_id = _get_request_id(request)
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ── Request models ────────────────────────────────────────────────────────────

class SegmentByPathRequest(BaseModel):
    file_path: str
    jaw: str
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
        "ready": _model_state == ModelState.ready,
        "model_state": _model_state.value,
        "model_loaded": _model_state == ModelState.ready,
        "model_error": _model_error,
        "tgn_enabled": TGN_ENABLED,
        "device": "cuda" if cuda else "cpu",
        "gpu_acceleration": cuda,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "checkpoint_sha256_fps": _checkpoint_sha256.get("fps", "")[:16] or None,
        "checkpoint_sha256_bdl": _checkpoint_sha256.get("bdl", "")[:16] or None,
        "research_use": True,
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
    request: Request,
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
    if not TGN_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="TGN inference is disabled. Set TGN_ENABLED=true to enable.",
        )
    if _model_state == ModelState.unavailable:
        raise HTTPException(
            status_code=503,
            detail="Model unavailable: checkpoints not found or TGN_ENABLED=false.",
        )
    if _model_state == ModelState.failed:
        raise HTTPException(
            status_code=503,
            detail=f"Model failed to load: {_model_error}",
        )
    if file is None:
        raise HTTPException(status_code=400, detail="file field is required")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in {".stl", ".obj", ".ply", ".off"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: .stl .obj .ply .off",
        )

    # Enforce upload size limit before reading into memory
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Upload too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
        )

    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    job_id = str(uuid.uuid4())
    _sid = scan_id or job_id[:8]

    # Save upload scoped to job_id directory
    job_upload_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_upload_dir, exist_ok=True)
    saved_path = os.path.join(job_upload_dir, f"upload{ext}")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Upload too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
        )
    with open(saved_path, "wb") as fh:
        fh.write(content)

    _metrics["jobs_queued"] += 1
    _job_set(
        job_id,
        {
            "status": "queued",
            "job_id": job_id,
            "request_id": request_id,
            "scan_id": _sid,
            "jaw": jaw,
            "queued_at": _now(),
            "research_use": True,
        },
    )

    background_tasks.add_task(
        _run_inference_async, job_id, saved_path, jaw, _sid, request_id
    )

    return {
        "job_id": job_id,
        "request_id": request_id,
        "status": "queued",
        "message": f"Segmentation job queued. Poll /jobs/{job_id} for results.",
        "research_use": True,
        "research_use_notice": RESEARCH_USE_NOTICE,
        "disclaimer": CLINICAL_DISCLAIMER,
    }


@app.post("/segment/by-path", dependencies=[Depends(_require_token)])
async def segment_by_path(
    req: SegmentByPathRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Submit a segmentation job referencing a file on shared storage.

    The file_path must resolve within TGN_ALLOWED_PATH_DIRS (colon-separated).
    Used by the MyOrtho ai-engine when files are on a shared volume.
    """
    if not TGN_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="TGN inference is disabled. Set TGN_ENABLED=true to enable.",
        )
    if _model_state == ModelState.unavailable:
        raise HTTPException(status_code=503, detail="Model unavailable.")
    if _model_state == ModelState.failed:
        raise HTTPException(status_code=503, detail=f"Model failed to load: {_model_error}")

    # Path validation — do not expose the real path in error messages
    try:
        safe_path = _assert_safe_path(req.file_path)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="file_path is outside the allowed upload directories.",
        )

    if not os.path.isfile(safe_path):
        raise HTTPException(status_code=400, detail="Referenced file not found.")

    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    job_id = str(uuid.uuid4())
    _sid = req.scan_id or job_id[:8]

    _metrics["jobs_queued"] += 1
    _job_set(
        job_id,
        {
            "status": "queued",
            "job_id": job_id,
            "request_id": request_id,
            "scan_id": _sid,
            "jaw": req.jaw,
            "queued_at": _now(),
            "research_use": True,
        },
    )

    background_tasks.add_task(
        _run_inference_async, job_id, safe_path, req.jaw, _sid, request_id
    )

    return {
        "job_id": job_id,
        "request_id": request_id,
        "status": "queued",
        "message": f"Segmentation job queued. Poll /jobs/{job_id} for results.",
        "research_use": True,
        "research_use_notice": RESEARCH_USE_NOTICE,
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
