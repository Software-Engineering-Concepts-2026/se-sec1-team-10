import sys
from pathlib import Path

from fastapi.testclient import TestClient

service_path = Path(__file__).resolve().parents[2] / "services" / "stats-service"
sys.path.insert(0, str(service_path))

from app import app

client = TestClient(app)


def test_root_reports_service_metadata():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "service": "stats-service",
        "status": "ok",
        "version": "0.1.0",
    }


def test_health_reports_healthy():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_stats_returns_zeroed_initial_totals():
    response = client.get("/stats")

    assert response.status_code == 200
    assert response.json() == {
        "calories_in": 0,
        "calories_out": 0,
        "net_calories": 0,
    }
