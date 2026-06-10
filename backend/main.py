"""FastAPI backend for ConcreteDSS.

Stateless compute service with per-scope datasets/models:
  - GET  /api/health          status + default model metrics
  - GET  /api/dataset         active dataset summary + source (per scope)
  - POST /api/dataset/upload  upload an industry dataset → validate → retrain
  - POST /api/dataset/reset   revert a scope to the default UCI dataset
  - POST /api/optimize        NSGA-II Pareto optimization (per scope)
  - POST /api/predict         predict strength/CO2/cost for a single mix
  - POST /api/report          scenario PDF report

Scope is selected by user_id (persistent, logged-in) or session_id (temporary).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import config
import data
import dataset_io
import emissions
import model as model_mod
import optimizer
import store
from report import build_scenario_report
from schemas import OptimizeRequest, PredictRequest, ReportRequest, ResetRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("concretedss")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading default dataset and ML model…")
    ws = store.default_workspace()
    logger.info("Default model ready: R²=%s, RMSE=%s MPa",
                ws.metrics.get("r2"), ws.metrics.get("rmse"))
    yield


app = FastAPI(title="ConcreteDSS API", version="3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    ws = store.default_workspace()
    return {"status": "ok", "currency": config.CURRENCY, "model": ws.metrics}


@app.get("/api/dataset")
def dataset(user_id: str | None = None, session_id: str | None = None) -> dict:
    ws = store.resolve(user_id, session_id)
    summary = data.dataset_summary(ws.df)
    summary.update({"source": ws.source, "model": ws.metrics})
    return summary


@app.post("/api/dataset/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    user_id: str | None = Form(default=None),
    session_id: str | None = Form(default=None),
    mode: str = Form(default="combine"),
) -> dict:
    if mode not in ("combine", "replace"):
        raise HTTPException(status_code=400, detail="mode must be 'combine' or 'replace'.")
    content = await file.read()
    try:
        df, report = dataset_io.parse_and_validate(content, file.filename or "upload")
    except dataset_io.DatasetError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ws, new_session = store.set_uploaded(
        df, file.filename or "upload", user_id, session_id, mode=mode
    )
    optimizer.clear_cache(ws.scope_id)

    return {
        "source": ws.source,
        "session_id": new_session,           # set for anonymous uploads; echo back on later calls
        "validation_report": report,
        "model": ws.metrics,
        "summary": data.dataset_summary(ws.df),
    }


@app.post("/api/dataset/reset")
def reset_dataset(req: ResetRequest) -> dict:
    ws_before = store.resolve(req.user_id, req.session_id)
    optimizer.clear_cache(ws_before.scope_id)
    store.reset(req.user_id, req.session_id)
    ws = store.resolve(req.user_id, req.session_id)
    return {"source": ws.source, "model": ws.metrics}


@app.post("/api/optimize")
def optimize(req: OptimizeRequest) -> dict:
    ws = store.resolve(req.user_id, req.session_id)
    return optimizer.optimize(
        ws,
        w_co2=req.w_co2,
        w_cost=req.w_cost,
        w_str=req.w_str,
        min_strength=req.min_strength,
        age=req.age,
        wc_min=req.wc_min,
        wc_max=req.wc_max,
    )


@app.post("/api/predict")
def predict(req: PredictRequest) -> dict:
    ws = store.resolve(req.user_id, req.session_id)
    mix = req.as_mix()
    return {
        "strength": round(model_mod.predict_one(ws.model, mix, req.age), 2),
        "co2": round(emissions.co2(mix), 2),
        "cost": round(emissions.cost(mix), 2),
        "currency": config.CURRENCY,
        "source": ws.source,
    }


@app.post("/api/report")
def report(req: ReportRequest) -> Response:
    metrics = store.resolve(req.user_id, req.session_id).metrics
    pdf_bytes = build_scenario_report(req.model_dump(), model_metrics=metrics)
    filename = (req.name or "scenario").strip().replace(" ", "_") or "scenario"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}_report.pdf"'},
    )
