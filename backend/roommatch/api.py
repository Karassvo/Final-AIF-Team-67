"""REST API (FastAPI). Run:  uvicorn roommatch.api:app --reload"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import __version__
from .algorithms.fuzzy import INPUTS, OUT_TERMS, RULES
from .engine import METHODS, RoomMatchEngine

app = FastAPI(title="RoomMatch API", version=__version__,
              description="AI-powered dormitory roommate matching")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

engine = RoomMatchEngine()


def jsonify(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {str(k): jsonify(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [jsonify(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return jsonify(obj.tolist())
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return None if np.isnan(obj) else float(obj)
    return obj


def ok(data: Any) -> JSONResponse:
    return JSONResponse(jsonify(data))


# ----------------------------------------------------------------- schemas
class GenerateReq(BaseModel):
    n_students: int = Field(240, ge=20, le=1200)
    seed: int = 42


class AssignReq(BaseModel):
    method: str = "fair_annealing"
    fairness: float = Field(0.5, ge=0.0, le=5.0)
    iterations: int = Field(25_000, ge=0, le=200_000)
    seed: int = 0


class CompareReq(BaseModel):
    iterations: int = Field(20_000, ge=1000, le=100_000)
    seeds: int = Field(3, ge=1, le=5)


class SurveyReq(BaseModel):
    name: str = "New student"
    gender: str = Field("F", pattern="^(F|M)$")
    year: int = Field(1, ge=1, le=6)
    faculty: str = "IT"
    bedtime: float = Field(23.5, ge=21, le=27)
    wake_time: float = Field(7.5, ge=5, le=12)
    cleanliness: float = Field(3, ge=1, le=5)
    noise_tolerance: float = Field(3, ge=1, le=5)
    guests: float = Field(3, ge=1, le=5)
    study_in_room: float = Field(3, ge=1, le=5)
    social: float = Field(3, ge=1, le=5)
    smoker: bool = False
    language: str = Field("kk", pattern="^(kk|ru|en)$")
    about: str = ""
    friend_id: Optional[int] = None


class LearnReq(BaseModel):
    generations: int = Field(40, ge=5, le=200)
    population: int = Field(40, ge=10, le=200)
    seed: int = 0


class SwapReq(BaseModel):
    a: int
    b: int


class KReq(BaseModel):
    k: Optional[int] = Field(None, ge=2, le=8)


# --------------------------------------------------------------- endpoints
@app.get("/api/health")
def health():
    return {"status": "ok", "version": __version__}


@app.get("/api/summary")
def summary():
    return ok(engine.summary())


@app.post("/api/generate")
def generate(req: GenerateReq):
    return ok(engine.generate(req.n_students, req.seed))


@app.get("/api/students")
def students():
    return ok(engine.list_students())


@app.get("/api/students/{sid}")
def student(sid: int):
    if sid not in engine.id2idx:
        raise HTTPException(404, "student not found")
    return ok(engine.student_detail(sid))


@app.post("/api/survey/preview")
def survey_preview(req: SurveyReq):
    return ok(engine.preview_passport(req.model_dump()))


@app.post("/api/survey")
def survey_submit(req: SurveyReq):
    return ok(engine.add_student(req.model_dump()))


@app.get("/api/dorm")
def dorm():
    return ok(engine.dorm_view())


@app.get("/api/clusters")
def clusters():
    return ok(engine.clusters())


@app.post("/api/clusters/k")
def clusters_k(req: KReq):
    return ok(engine.set_k(req.k))


@app.get("/api/pair")
def pair(a: int, b: int):
    if a not in engine.id2idx or b not in engine.id2idx:
        raise HTTPException(404, "student not found")
    return ok(engine.pair(a, b))


@app.get("/api/fuzzy/rules")
def fuzzy_rules():
    return ok({"inputs": INPUTS, "out_terms": OUT_TERMS,
               "rules": [{"if": a, "then": c} for a, c in RULES],
               "params": engine.fuzzy.params.to_dict(), "tuned": engine.tuned})


@app.get("/api/methods")
def methods():
    return METHODS


@app.post("/api/assign")
def assign(req: AssignReq):
    if req.method not in METHODS:
        raise HTTPException(400, f"unknown method; choose one of {list(METHODS)}")
    try:
        return ok(engine.assign(req.method, req.fairness, req.iterations, req.seed))
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.post("/api/compare")
def compare(req: CompareReq):
    return ok(engine.compare(req.iterations, tuple(range(req.seeds))))


@app.post("/api/swap")
def swap(req: SwapReq):
    try:
        return ok(engine.apply_swap(req.a, req.b))
    except (ValueError, KeyError) as e:
        raise HTTPException(422, str(e))


@app.post("/api/learn")
def learn(req: LearnReq):
    return ok(engine.learn(generations=req.generations, population=req.population, seed=req.seed))


@app.get("/api/learn")
def learn_result():
    return ok(engine.learn_result)


@app.post("/api/learn/apply")
def learn_apply():
    try:
        return ok(engine.apply_learned())
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.post("/api/learn/reset")
def learn_reset():
    return ok(engine.reset_fuzzy())


@app.post("/api/upload/students")
async def upload_students(file: UploadFile = File(...)):
    try:
        return ok(engine.import_students_csv((await file.read()).decode("utf-8-sig")))
    except Exception as e:  # noqa: BLE001 - report any parsing problem to the user
        raise HTTPException(400, f"Could not read CSV: {e}")


@app.post("/api/upload/feedback")
async def upload_feedback(file: UploadFile = File(...)):
    try:
        return ok(engine.load_feedback_csv((await file.read()).decode("utf-8-sig")))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not read CSV: {e}")


@app.get("/api/export.csv", response_class=PlainTextResponse)
def export_csv():
    return PlainTextResponse(engine.export_csv(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=roommatch_assignment.csv"})


# ------------------------------------------------- serve the built frontend
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        target = DIST / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
