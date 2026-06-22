"""Smoke & logic tests for the AI engine API.

These exercise the deterministic endpoints (health, readiness, staging math,
model registry) without requiring real scan files or a GPU.
"""
import pytest
from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


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
    # 1.0mm at 0.25mm/step -> 4 stages, last step lands on target
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
            "file_path": "/tmp/nonexistent.stl",
            "jaw_type": "maxillary",
        },
    )
    # Endpoint should accept and queue regardless of file validity
    assert res.status_code == 200
    assert res.json()["status"] == "queued"
