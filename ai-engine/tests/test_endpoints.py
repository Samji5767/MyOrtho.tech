"""
Smoke & logic tests for the AI engine API.

These exercise deterministic endpoints (health, readiness, staging math,
model registry, segmentation queue) without requiring real scan files or a GPU.

Auth is bypassed via FastAPI dependency_overrides so tests focus on business
logic, not credential plumbing.
"""
import pytest
from fastapi.testclient import TestClient

from src.auth import require_auth
from src.main import app

# ── Auth bypass fixture ───────────────────────────────────────────────────────

_MOCK_AUTH = {"sub": "test-user", "orgId": "test-org", "role": "admin"}


@pytest.fixture(autouse=True)
def bypass_auth():
    """Override require_auth for all tests so no real JWT is needed."""
    app.dependency_overrides[require_auth] = lambda: _MOCK_AUTH
    yield
    app.dependency_overrides.clear()


client = TestClient(app)


# ── Unauthenticated probes ────────────────────────────────────────────────────

def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "myortho-ai-engine"


def test_ready_reports_device():
    res = client.get("/ready")
    assert res.status_code == 200
    body = res.json()
    assert body["ready"] is True
    assert body["device"] in ("cpu", "cuda")


# ── Authenticated endpoints ───────────────────────────────────────────────────

def test_models_registry():
    res = client.get("/ai/models")
    assert res.status_code == 200
    names = [m["model_name"] for m in res.json()["active_models"]]
    assert "OrthoSegmentationUNet" in names


def test_autostage_divides_movement_into_steps():
    res = client.post(
        "/ai/autostage",
        json={
            "tooth_id": 11,
            "current_translation": [0.0, 0.0, 0.0],
            "target_translation": [1.0, 0.0, 0.0],
            "max_step_mm": 0.25,
        },
    )
    assert res.status_code == 200
    body = res.json()
    # 1.0 mm at 0.25 mm/step → 4 stages; last step lands on target
    assert body["total_stages"] == 4
    assert body["steps"][-1]["translation"] == pytest.approx([1.0, 0.0, 0.0])


def test_autostage_handles_zero_movement():
    res = client.post(
        "/ai/autostage",
        json={
            "tooth_id": 21,
            "current_translation": [2.0, 2.0, 2.0],
            "target_translation": [2.0, 2.0, 2.0],
            "max_step_mm": 0.25,
        },
    )
    assert res.status_code == 200
    assert res.json()["total_stages"] == 1


def test_segment_endpoint_queues_background_task():
    res = client.post(
        "/ai/segment",
        json={
            "case_id": "c1",
            "scan_id": "s1",
            "file_path": "/tmp/test.stl",
            "jaw_type": "maxillary",
        },
    )
    # Endpoint accepts and queues regardless of file existence
    assert res.status_code == 200
    assert res.json()["status"] == "queued"
    assert "job_id" in res.json()


def test_auth_required_without_override():
    """Confirm that removing the override triggers 401 or 500 (no JWT_SECRET)."""
    app.dependency_overrides.clear()
    res = client.get("/ai/models")
    # 401 if JWT_SECRET set, 500 if not configured — both indicate auth is enforced
    assert res.status_code in (401, 500)
    # Restore for any subsequent tests in same session
    app.dependency_overrides[require_auth] = lambda: _MOCK_AUTH


def test_response_has_trace_id_header():
    res = client.get("/health")
    assert "x-trace-id" in res.headers or "X-Trace-Id" in res.headers


def test_response_has_api_version_header():
    res = client.get("/health")
    assert res.headers.get("x-api-version") == "1" or res.headers.get("X-API-Version") == "1"
