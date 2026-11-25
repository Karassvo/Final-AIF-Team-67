import pytest
from fastapi.testclient import TestClient

from roommatch.api import app, engine


@pytest.fixture(scope="module")
def client():
    engine.generate(120, seed=11)
    return TestClient(app)


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_summary_and_dorm(client):
    s = client.get("/api/summary").json()
    assert s["n_students"] == 120 and s["metrics"]["mean_score"] > 0
    d = client.get("/api/dorm").json()
    residents = sum(len(r["residents"]) for f in d["floors"] for r in f["rooms"])
    assert residents == 120


def test_clusters(client):
    c = client.get("/api/clusters").json()
    assert len(c["points"]) == 120 and c["k"] == len(c["clusters"])


def test_pair_and_student(client):
    ids = [s["id"] for s in client.get("/api/students").json()]
    p = client.get(f"/api/pair?a={ids[0]}&b={ids[1]}").json()
    assert 0 <= p["score"] <= 100 and "fired_rules" in p["fuzzy"]
    st = client.get(f"/api/students/{ids[0]}").json()
    assert st["room"]["id"] and len(st["top_matches"]) > 0


def test_assign_methods(client):
    for m in ("random", "greedy", "annealing", "fair_annealing"):
        r = client.post("/api/assign", json={"method": m, "iterations": 3000}).json()
        assert r["violations"] == []
    assert client.post("/api/assign", json={"method": "nope"}).status_code == 400


def test_survey_flow(client):
    body = {"name": "Aru", "gender": "F", "bedtime": 23, "wake_time": 7, "cleanliness": 5,
            "noise_tolerance": 2, "guests": 1, "study_in_room": 5, "social": 2, "smoker": False,
            "language": "kk", "about": "Маған шахмат пен кітап ұнайды"}
    n_before = client.get("/api/summary").json()["n_students"]
    prev = client.post("/api/survey/preview", json=body).json()
    assert prev["cluster"]["key"] and client.get("/api/summary").json()["n_students"] == n_before
    res = client.post("/api/survey", json=body).json()
    assert res["placed"]["room"] and client.get("/api/summary").json()["n_students"] == n_before + 1


def test_learning(client):
    r = client.post("/api/learn", json={"generations": 6, "population": 12}).json()
    assert r["tree"]["metrics"]["accuracy"] > 0.6
    a = client.post("/api/learn/apply").json()
    assert "after" in a
    client.post("/api/learn/reset")


def test_export(client):
    text = client.get("/api/export.csv").text
    assert text.startswith("student_id")


def test_upload_template_csv(client):
    from pathlib import Path
    path = Path(__file__).resolve().parents[2] / "data" / "students_template.csv"
    with open(path, "rb") as f:
        r = client.post("/api/upload/students", files={"file": ("students.csv", f, "text/csv")})
    assert r.status_code == 200 and r.json()["n_students"] == 60
    text = path.read_text(encoding="utf-8")
    assert r.json()["smokers"] == text.count(",True,")
    engine.generate(120, seed=11)
