"""
MyOrtho AI Engine — FastAPI application.

Phase 30 security hardening:
  - JWT / internal-token auth on every endpoint except /health and /ready
  - File path sandboxed to UPLOADS_DIR when that env var is set
  - Async inference timeout via asyncio.wait_for + ThreadPoolExecutor
  - X-Trace-Id propagated on every response
  - API version reported in X-API-Version response header
"""

import asyncio
import json
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import numpy as np
import torch
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.auth import get_trace_id, require_auth, require_upload_size
from src.landmark_detector import DentalLandmarkDetector
from src.mesh_processing import MeshProcessor
from src.root_predictor import RootPredictorEngine
from src.segmentation import INFERENCE_TIMEOUT_SEC, OrthoSegmentationEngine

# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="MyOrtho AI & Mesh Processing Engine",
    description=(
        "High-performance compute node for tooth segmentation and WATERTIGHT STL preparation. "
        "All endpoints except /health and /ready require authentication."
    ),
    version="1.0.0",
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-engine")

# ── Upload directory (path sandboxing) ───────────────────────────────────────

_UPLOADS_DIR: Optional[str] = None

def _get_uploads_dir() -> Optional[str]:
    raw = os.getenv("UPLOADS_DIR", "").strip()
    return os.path.realpath(raw) if raw else None


def _assert_safe_path(file_path: str) -> str:
    """
    Prevent path traversal.
    - If UPLOADS_DIR is set: file_path must resolve within it.
    - If UPLOADS_DIR is unset: only basic ``..`` traversal is rejected.
    Returns the normalized absolute path on success.
    Raises HTTP 400 on violation.
    """
    norm = os.path.normpath(file_path)
    # Basic traversal: reject paths that still contain '..' after normpath
    if ".." in norm.split(os.sep):
        raise HTTPException(status_code=400, detail="Invalid file path (path traversal detected)")

    uploads = _UPLOADS_DIR
    if uploads:
        real = os.path.realpath(norm)
        if not real.startswith(uploads + os.sep) and real != uploads:
            raise HTTPException(
                status_code=400,
                detail="file_path must be within the configured uploads directory",
            )
    return norm


# ── Engine singletons ─────────────────────────────────────────────────────────

segmentation_engine = OrthoSegmentationEngine()
mesh_processor = MeshProcessor()
landmark_detector = DentalLandmarkDetector()
root_predictor = RootPredictorEngine()

# Thread pool for blocking inference calls (keeps the async event loop free)
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="seg-worker")

# ── Job Store: Redis-backed with in-memory fallback ───────────────────────────

_redis_client: Optional[Any] = None
_memory_fallback: Dict[str, Dict[str, Any]] = {}
JOB_TTL_SECONDS = 86_400 * 7  # 7 days


def _init_redis() -> Optional[Any]:
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    try:
        import redis as redis_lib  # type: ignore
        client = redis_lib.Redis.from_url(
            redis_url,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        client.ping()
        logger.info(f"AI engine connected to Redis at {redis_url}")
        return client
    except Exception as exc:
        logger.warning(f"Redis unavailable ({exc}); using in-memory job store")
        return None


def _job_set(job_id: str, data: Dict[str, Any]) -> None:
    if _redis_client:
        try:
            _redis_client.setex(f"mo:job:{job_id}", JOB_TTL_SECONDS, json.dumps(data))
            return
        except Exception:
            pass
    _memory_fallback[job_id] = data


def _job_get(job_id: str) -> Optional[Dict[str, Any]]:
    if _redis_client:
        try:
            raw = _redis_client.get(f"mo:job:{job_id}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return _memory_fallback.get(job_id)


# ── CORS (internal service — only the NestJS backend should reach this) ──────

_ALLOWED_ORIGINS = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS or ["http://localhost:4000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "X-Internal-Token", "Content-Type"],
)

# ── Middleware ────────────────────────────────────────────────────────────────

@app.middleware("http")
async def attach_trace_and_version(request: Request, call_next):
    response: Response = await call_next(request)
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))
    response.headers["X-Trace-Id"] = trace_id
    response.headers["X-API-Version"] = "1"
    return response


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    global _redis_client, _UPLOADS_DIR
    _redis_client = _init_redis()
    _UPLOADS_DIR = _get_uploads_dir()
    if _UPLOADS_DIR:
        logger.info(f"File path sandboxing enabled: uploads must be within {_UPLOADS_DIR}")
    else:
        logger.warning(
            "UPLOADS_DIR not set — file path sandboxing is disabled. "
            "Set UPLOADS_DIR in production."
        )


# ── Request models ────────────────────────────────────────────────────────────

class SegmentationRequest(BaseModel):
    case_id: str
    scan_id: str
    file_path: str
    jaw_type: str  # "maxillary" | "mandibular" | "combined" | "auto"


class HollowRequest(BaseModel):
    input_mesh_path: str
    output_mesh_path: str
    wall_thickness_mm: float = 2.0
    engrave_label: str = ""


class LandmarkRequest(BaseModel):
    mesh_path: str
    tooth_id: int


class CollisionRequest(BaseModel):
    centerline_a: list
    centerline_b: list
    min_clearance_mm: float = 1.5


class AutoStageRequest(BaseModel):
    tooth_id: int
    current_translation: list
    target_translation: list
    max_step_mm: float = 0.25


class ToothPrescription(BaseModel):
    tooth_number: int          # FDI code e.g. 11, 21, 31
    translation_mesial_mm: float = 0.0
    translation_distal_mm: float = 0.0
    translation_buccal_mm: float = 0.0
    translation_lingual_mm: float = 0.0
    rotation_deg: float = 0.0
    torque_deg: float = 0.0
    intrusion_mm: float = 0.0
    extrusion_mm: float = 0.0
    mesialization_mm: float = 0.0
    distalization_mm: float = 0.0
    expansion_mm: float = 0.0
    constriction_mm: float = 0.0
    total_stages: int = 1


class GenerateStageStlsRequest(BaseModel):
    plan_id: str
    case_id: str
    segmented_mesh_dir: str          # directory containing tooth_fdi_{N}.stl files
    prescriptions: list[ToothPrescription]
    total_active_stages: int


# ── Background segmentation task (async, with timeout) ───────────────────────

async def run_segmentation_task(job_id: str, req: SegmentationRequest) -> None:
    existing = _job_get(job_id) or {}
    existing["status"] = "processing"
    existing["started_at"] = datetime.now(timezone.utc).isoformat()
    _job_set(job_id, existing)
    logger.info(
        f"Running segmentation — case={req.case_id} scan={req.scan_id} job={job_id}"
    )

    loop = asyncio.get_event_loop()
    try:
        results = await asyncio.wait_for(
            loop.run_in_executor(
                _executor,
                lambda: segmentation_engine.segment_mesh(req.file_path, req.jaw_type),
            ),
            timeout=float(INFERENCE_TIMEOUT_SEC),
        )
        _job_set(
            job_id,
            {
                "status": "completed",
                "case_id": req.case_id,
                "scan_id": req.scan_id,
                "teeth_detected": len(results.get("tooth_ids", [])),
                "tooth_ids": results.get("tooth_ids", []),
                "missing_teeth": results.get("missing_teeth", []),
                "teeth_confidence": results.get("confidence_scores", {}),
                "confidence_maps": results.get("confidence_maps", {}),
                "weights_loaded": results.get("weights_loaded", False),
                "warning": results.get("warning"),
                "segmented_mesh_path": results.get("segmented_mesh_path"),
                "timing": results.get("timing", {}),
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "disclaimer": (
                    "Segmentation is a workflow tool only. "
                    "Not clinically validated. Requires review by a licensed clinician."
                ),
            },
        )
        logger.info(f"Segmentation completed — job={job_id}")
    except asyncio.TimeoutError:
        _job_set(
            job_id,
            {
                "status": "failed",
                "case_id": req.case_id,
                "scan_id": req.scan_id,
                "error": f"Inference timed out after {INFERENCE_TIMEOUT_SEC}s",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.error(f"Segmentation job {job_id} timed out after {INFERENCE_TIMEOUT_SEC}s")
    except Exception as exc:
        _job_set(
            job_id,
            {
                "status": "failed",
                "case_id": req.case_id,
                "scan_id": req.scan_id,
                "error": "Segmentation processing error",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.error(f"Segmentation job {job_id} failed: {exc}")


# ── Unauthenticated health probes ─────────────────────────────────────────────

@app.get("/health")
async def health():
    """Liveness probe — process is up and serving."""
    return {"status": "ok", "service": "myortho-ai-engine", "version": app.version}


@app.get("/ready")
async def ready():
    """Readiness probe — reports active compute backend."""
    cuda = torch.cuda.is_available()
    return {
        "ready": True,
        "device": "cuda" if cuda else "cpu",
        "gpu_acceleration": cuda,
        "models_loaded": True,
        "segmentation_weights_loaded": segmentation_engine.weights_loaded,
    }


# ── Authenticated endpoints ───────────────────────────────────────────────────

@app.post(
    "/ai/segment",
    dependencies=[Depends(require_auth), Depends(require_upload_size)],
)
async def trigger_segmentation(
    req: SegmentationRequest,
    background_tasks: BackgroundTasks,
):
    safe_path = _assert_safe_path(req.file_path)
    req = SegmentationRequest(
        case_id=req.case_id,
        scan_id=req.scan_id,
        file_path=safe_path,
        jaw_type=req.jaw_type,
    )

    job_id = str(uuid.uuid4())
    _job_set(
        job_id,
        {
            "status": "queued",
            "case_id": req.case_id,
            "scan_id": req.scan_id,
            "queued_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    background_tasks.add_task(run_segmentation_task, job_id, req)
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Segmentation job queued. Poll /ai/jobs/{job_id} for status.",
        "disclaimer": (
            "Not clinically validated. For workflow assistance only. "
            "Requires a licensed clinician's review before any clinical decision."
        ),
    }


@app.get(
    "/ai/jobs/{job_id}",
    dependencies=[Depends(require_auth)],
)
async def get_job_status(job_id: str):
    job = _job_get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found. Jobs expire after 7 days.",
        )
    return {"job_id": job_id, **job}


@app.post(
    "/mesh/hollow",
    dependencies=[Depends(require_auth), Depends(require_upload_size)],
)
async def hollow_mesh(req: HollowRequest):
    safe_in = _assert_safe_path(req.input_mesh_path)
    safe_out = _assert_safe_path(req.output_mesh_path)
    try:
        success = mesh_processor.hollow_and_label(
            safe_in,
            safe_out,
            req.wall_thickness_mm,
            req.engrave_label,
        )
        if not success:
            raise HTTPException(status_code=500, detail="Mesh hollowing failed")
        return {"status": "success", "output_path": safe_out}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("hollow_mesh error: %s", exc)
        raise HTTPException(status_code=500, detail="Internal processing error") from exc


@app.post(
    "/ai/landmarks",
    dependencies=[Depends(require_auth)],
)
async def detect_landmarks(req: LandmarkRequest):
    safe_path = _assert_safe_path(req.mesh_path)
    try:
        return landmark_detector.detect_landmarks(safe_path, req.tooth_id)
    except Exception as exc:
        logger.error("detect_landmarks error: %s", exc)
        raise HTTPException(status_code=500, detail="Internal processing error") from exc


@app.post(
    "/ai/collision",
    dependencies=[Depends(require_auth)],
)
async def check_collision(req: CollisionRequest):
    try:
        arr_a = np.array(req.centerline_a)
        arr_b = np.array(req.centerline_b)
        return root_predictor.calculate_root_collision(arr_a, arr_b, req.min_clearance_mm)
    except Exception as exc:
        logger.error("check_collision error: %s", exc)
        raise HTTPException(status_code=500, detail="Internal processing error") from exc


@app.post(
    "/ai/autostage",
    dependencies=[Depends(require_auth)],
)
async def generate_stages(req: AutoStageRequest):
    try:
        curr = np.array(req.current_translation)
        target = np.array(req.target_translation)
        diff = target - curr
        distance = float(np.linalg.norm(diff))

        stages_count = max(1, int(np.ceil(distance / req.max_step_mm)))
        steps = [
            {
                "stage_number": i,
                "translation": list(map(float, curr + diff * (i / stages_count))),
            }
            for i in range(1, stages_count + 1)
        ]
        return {"tooth_id": req.tooth_id, "total_stages": stages_count, "steps": steps}
    except Exception as exc:
        logger.error("generate_stages error: %s", exc)
        raise HTTPException(status_code=500, detail="Internal processing error") from exc


@app.post(
    "/ai/generate-stage-stls",
    dependencies=[Depends(require_auth)],
)
async def generate_stage_stls(req: GenerateStageStlsRequest):
    """
    Read per-tooth STL files from segmented_mesh_dir, apply per-stage movement
    transforms derived from movement prescriptions, and write one combined-arch
    STL per active stage.  Returns the output directory path.

    Coordinate convention (simplified arch-frame approximation):
      +X = mesial, +Y = buccal, +Z = extrusion
    """
    import zipfile
    import math

    safe_dir = _assert_safe_path(req.segmented_mesh_dir)
    if not os.path.isdir(safe_dir):
        raise HTTPException(status_code=400, detail="segmented_mesh_dir does not exist")

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _executor,
            lambda: _build_stage_stls(safe_dir, req),
        )
        return result
    except Exception as exc:
        logger.error("generate_stage_stls error: %s", exc)
        raise HTTPException(status_code=500, detail="Internal processing error") from exc


def _build_stage_stls(seg_dir: str, req: "GenerateStageStlsRequest") -> dict:
    """Synchronous worker: build per-stage STL files and zip them."""
    import zipfile
    import math

    # Load all available tooth meshes
    tooth_meshes: dict[int, "trimesh.Trimesh"] = {}
    for p in os.listdir(seg_dir):
        if p.startswith("tooth_fdi_") and p.endswith(".stl"):
            try:
                fdi = int(p[len("tooth_fdi_"):-len(".stl")])
                tooth_meshes[fdi] = trimesh.load(
                    os.path.join(seg_dir, p), force="mesh"
                )
            except Exception:
                continue

    if not tooth_meshes:
        raise ValueError("No tooth STL files found in segmented_mesh_dir")

    presc_by_tooth = {p.tooth_number: p for p in req.prescriptions}
    output_dir = os.path.join(seg_dir, f"stages_{req.plan_id}")
    os.makedirs(output_dir, exist_ok=True)

    for stage in range(1, req.total_active_stages + 1):
        stage_meshes = []
        for fdi, base_mesh in tooth_meshes.items():
            presc = presc_by_tooth.get(fdi)
            if presc is None:
                stage_meshes.append(base_mesh.copy())
                continue

            total_s = max(1, presc.total_stages)
            # Linear interpolation fraction at this stage
            frac = min(1.0, stage / total_s)

            # Cumulative translation vector (arch-frame approximation)
            tx = (presc.translation_mesial_mm - presc.translation_distal_mm
                  + presc.mesialization_mm - presc.distalization_mm) * frac
            ty = (presc.translation_buccal_mm - presc.translation_lingual_mm
                  + presc.expansion_mm - presc.constriction_mm) * frac
            tz = (presc.extrusion_mm - presc.intrusion_mm) * frac
            translation = np.array([tx, ty, tz])

            # Rotation around Z through tooth centroid (long-axis rotation)
            rot_deg = presc.rotation_deg * frac
            rot_rad = math.radians(rot_deg)
            centroid = base_mesh.centroid

            moved = base_mesh.copy()
            moved.vertices = moved.vertices + translation
            if abs(rot_rad) > 1e-6:
                cos_r, sin_r = math.cos(rot_rad), math.sin(rot_rad)
                verts = moved.vertices - centroid
                x_rot = verts[:, 0] * cos_r - verts[:, 1] * sin_r
                y_rot = verts[:, 0] * sin_r + verts[:, 1] * cos_r
                verts[:, 0] = x_rot
                verts[:, 1] = y_rot
                moved.vertices = verts + centroid

            stage_meshes.append(moved)

        if stage_meshes:
            combined = trimesh.util.concatenate(stage_meshes)
            stage_path = os.path.join(output_dir, f"stage_{stage:03d}.stl")
            combined.export(stage_path)

    # Zip the stage STL files
    zip_path = os.path.join(seg_dir, f"aligner_plan_{req.plan_id}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in sorted(os.listdir(output_dir)):
            if fname.endswith(".stl"):
                zf.write(os.path.join(output_dir, fname), fname)

    return {
        "success": True,
        "plan_id": req.plan_id,
        "stages_generated": req.total_active_stages,
        "output_dir": output_dir,
        "zip_path": zip_path,
    }


@app.get(
    "/ai/models",
    dependencies=[Depends(require_auth)],
)
async def get_models():
    return {
        "active_models": [
            {
                "model_name": "OrthoSegmentationUNet",
                "version": "v2.1.4",
                "framework": "MONAI/PyTorch",
                "gpu_acceleration": torch.cuda.is_available(),
                "weights_loaded": segmentation_engine.weights_loaded,
            },
            {
                "model_name": "LandmarkMeanCurvature",
                "version": "v1.0.8",
                "framework": "Trimesh/Scipy",
                "weights_loaded": True,
            },
            {
                "model_name": "RootCollisionCenterline",
                "version": "v1.2.0",
                "framework": "Numpy/ICP",
                "weights_loaded": True,
            },
        ],
        "validation_status": "not_clinically_validated",
        "clinical_disclaimer": (
            "These models are research-stage prototypes. They have NOT been cleared as "
            "Software as a Medical Device (SaMD). Do not use outputs for clinical decisions."
        ),
        "last_verification_run": "2026-06-15",
    }
