from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging
import uuid
import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import numpy as np
import torch
from src.segmentation import OrthoSegmentationEngine
from src.mesh_processing import MeshProcessor
from src.landmark_detector import DentalLandmarkDetector
from src.root_predictor import RootPredictorEngine

app = FastAPI(
    title="MyOrtho AI & Mesh Processing Engine",
    description="High-performance compute node for tooth segmentation and WATERTIGHT STL preparation.",
    version="1.0.0"
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-engine")

segmentation_engine = OrthoSegmentationEngine()
mesh_processor = MeshProcessor()
landmark_detector = DentalLandmarkDetector()
root_predictor = RootPredictorEngine()

# ── Job Store: Redis-backed with in-memory fallback ───────────────────────────

_redis_client: Optional[Any] = None
_memory_fallback: Dict[str, Dict[str, Any]] = {}
JOB_TTL_SECONDS = 86400 * 7  # 7 days

def _init_redis() -> Optional[Any]:
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    try:
        import redis as redis_lib  # type: ignore
        client = redis_lib.Redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2, decode_responses=True)
        client.ping()
        logger.info(f"AI engine connected to Redis at {redis_url}")
        return client
    except Exception as exc:
        logger.warning(f"Redis unavailable ({exc}); falling back to in-memory job store")
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

@app.on_event("startup")
async def startup():
    global _redis_client
    _redis_client = _init_redis()

class SegmentationRequest(BaseModel):
    case_id: str
    scan_id: str
    file_path: str
    jaw_type: str  # "maxillary" or "mandibular"

class HollowRequest(BaseModel):
    input_mesh_path: str
    output_mesh_path: str
    wall_thickness_mm: float = 2.0
    engrave_label: str = ""

class LandmarkRequest(BaseModel):
    mesh_path: str
    tooth_id: int

class CollisionRequest(BaseModel):
    centerline_a: list  # list of [x, y, z] points
    centerline_b: list
    min_clearance_mm: float = 1.5

class AutoStageRequest(BaseModel):
    tooth_id: int
    current_translation: list  # [x, y, z]
    target_translation: list   # [x, y, z]
    max_step_mm: float = 0.25

def run_segmentation_task(job_id: str, req: SegmentationRequest):
    existing = _job_get(job_id) or {}
    existing["status"] = "processing"
    existing["started_at"] = datetime.now(timezone.utc).isoformat()
    _job_set(job_id, existing)
    logger.info(f"Running tooth segmentation on scan {req.scan_id} for case {req.case_id} (job {job_id})")
    try:
        results = segmentation_engine.segment_mesh(req.file_path, req.jaw_type)
        _job_set(job_id, {
            "status": "completed",
            "case_id": req.case_id,
            "scan_id": req.scan_id,
            "teeth_detected": len(results.get("tooth_ids", [])),
            "missing_teeth": results.get("missing_teeth", []),
            "teeth_confidence": results.get("confidence_scores", {}),
            "segmented_mesh_path": results.get("segmented_mesh_path"),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "disclaimer": "Segmentation is a workflow tool only. Not clinically validated.",
        })
        logger.info(f"Segmentation complete for job {job_id}. Missing teeth: {results.get('missing_teeth', [])}")
    except Exception as e:
        _job_set(job_id, {
            "status": "failed",
            "case_id": req.case_id,
            "scan_id": req.scan_id,
            "error": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.error(f"Segmentation job {job_id} failed: {str(e)}")

@app.get("/health")
async def health():
    """Liveness probe: the process is up and serving requests."""
    return {"status": "ok", "service": "myortho-ai-engine", "version": app.version}


@app.get("/ready")
async def ready():
    """Readiness probe: report the active compute backend."""
    cuda = torch.cuda.is_available()
    return {
        "ready": True,
        "device": "cuda" if cuda else "cpu",
        "gpu_acceleration": cuda,
        "models_loaded": True,
    }


@app.post("/ai/segment")
async def trigger_segmentation(req: SegmentationRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    _job_set(job_id, {
        "status": "queued",
        "case_id": req.case_id,
        "scan_id": req.scan_id,
        "queued_at": datetime.now(timezone.utc).isoformat(),
    })
    background_tasks.add_task(run_segmentation_task, job_id, req)
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Segmentation job queued. Poll /ai/jobs/{job_id} for status.",
        "disclaimer": "Not clinically validated. For workflow assistance only.",
    }

@app.get("/ai/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = _job_get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found. Jobs expire after 7 days."
        )
    return {"job_id": job_id, **job}

@app.post("/mesh/hollow")
async def hollow_mesh(req: HollowRequest):
    logger.info(f"Processing mesh hollowing for file: {req.input_mesh_path}")
    try:
        success = mesh_processor.hollow_and_label(
            req.input_mesh_path,
            req.output_mesh_path,
            req.wall_thickness_mm,
            req.engrave_label
        )
        if not success:
            raise HTTPException(status_code=500, detail="Mesh hollowing or closure failed")
        return {"status": "success", "output_path": req.output_mesh_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/landmarks")
async def detect_landmarks(req: LandmarkRequest):
    try:
        return landmark_detector.detect_landmarks(req.mesh_path, req.tooth_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/collision")
async def check_collision(req: CollisionRequest):
    try:
        arr_a = np.array(req.centerline_a)
        arr_b = np.array(req.centerline_b)
        return root_predictor.calculate_root_collision(arr_a, arr_b, req.min_clearance_mm)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/autostage")
async def generate_stages(req: AutoStageRequest):
    try:
        curr = np.array(req.current_translation)
        target = np.array(req.target_translation)
        diff = target - curr
        distance = np.linalg.norm(diff)
        
        stages_count = int(np.ceil(distance / req.max_step_mm))
        if stages_count == 0:
            stages_count = 1
            
        steps = []
        for i in range(1, stages_count + 1):
            t = i / stages_count
            step_pos = curr + diff * t
            steps.append({
                "stage_number": i,
                "translation": [float(step_pos[0]), float(step_pos[1]), float(step_pos[2])]
            })
            
        return {
            "tooth_id": req.tooth_id,
            "total_stages": stages_count,
            "steps": steps
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ai/models")
async def get_models():
    return {
        "active_models": [
            {"model_name": "OrthoSegmentationUNet", "version": "v2.1.4", "framework": "MONAI/PyTorch", "gpu_acceleration": torch.cuda.is_available()},
            {"model_name": "LandmarkMeanCurvature", "version": "v1.0.8", "framework": "Trimesh/Scipy"},
            {"model_name": "RootCollisionCenterline", "version": "v1.2.0", "framework": "Numpy/ICP"}
        ],
        "validation_status": "not_clinically_validated",
        "clinical_disclaimer": "These models are research-stage prototypes. They have NOT been cleared as Software as a Medical Device (SaMD). Do not use outputs for clinical decisions.",
        "last_verification_run": "2026-06-15"
    }
