"""End-to-end backend tests: data, model, emissions, optimizer, store, upload, API."""
import io
import os
import sys

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
import data  # noqa: E402
import dataset_io  # noqa: E402
import emissions  # noqa: E402
import model as model_mod  # noqa: E402
import optimizer  # noqa: E402
import scoring  # noqa: E402
import store  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)

TEST_USER = "pytest_user"


@pytest.fixture
def industry_csv() -> bytes:
    """A CSV with industry-style (non-canonical) headers, derived from the default data."""
    df = data.load_default().head(200).copy()
    df.columns = [
        "Cement", "Blast Furnace Slag", "Fly Ash", "Water", "Superplasticizer",
        "Coarse Aggregate", "Fine Aggregate", "Age (day)", "Concrete Compressive Strength",
    ]
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode()


@pytest.fixture(autouse=True)
def _cleanup_test_user():
    yield
    store.reset(user_id=TEST_USER)
    optimizer.clear_cache()


# ── Data ──────────────────────────────────────────────────────────────────────
def test_default_dataset_loads():
    df = data.load_default()
    assert len(df) == 1030
    assert list(df.columns)[-1] == "strength"


def test_feature_bounds_valid():
    bounds = data.feature_bounds(data.load_default())
    for c in config.COMPONENTS:
        lo, hi = bounds[c]
        assert lo <= hi


# ── Model ─────────────────────────────────────────────────────────────────────
def test_default_model_accuracy_threshold():
    _, metrics = model_mod.default_model()
    assert metrics["r2"] > 0.85
    assert metrics["cv_r2_mean"] > 0.85
    assert metrics["rmse"] < 8.0


def test_predict_reasonable():
    m, _ = model_mod.default_model()
    mix = {"cement": 380, "slag": 95, "fly_ash": 0, "water": 190,
           "superplasticizer": 5, "coarse_agg": 1000, "fine_agg": 750}
    assert 0 < model_mod.predict_one(m, mix, age=28) < 120


# ── Emissions ─────────────────────────────────────────────────────────────────
def test_co2_cost_positive_and_monotonic():
    base = {c: 0.0 for c in config.COMPONENTS}
    base["cement"] = 300
    more = dict(base, cement=400)
    assert emissions.co2(base) > 0 and emissions.cost(base) > 0
    assert emissions.co2(more) > emissions.co2(base)


def test_emissions_vectorized_matches_scalar():
    mix = {"cement": 300, "slag": 50, "fly_ash": 20, "water": 170,
           "superplasticizer": 3, "coarse_agg": 1000, "fine_agg": 760}
    X = np.array([[mix[c] for c in config.COMPONENTS]])
    assert abs(emissions.co2_vec(X)[0] - emissions.co2(mix)) < 1e-6


# ── Scoring ───────────────────────────────────────────────────────────────────
def test_weighted_selection_respects_priority():
    co2 = np.array([100.0, 400.0])
    cost = np.array([40.0, 90.0])
    strength = np.array([30.0, 90.0])
    assert scoring.best_index(co2, cost, strength, 0, 0, 1) == 1   # strength priority
    assert scoring.best_index(co2, cost, strength, 1, 0, 0) == 0   # eco priority


# ── dataset_io ────────────────────────────────────────────────────────────────
def test_parse_maps_industry_headers(industry_csv):
    df, report = dataset_io.parse_and_validate(industry_csv, "data.csv")
    assert list(df.columns) == config.COMPONENTS + ["age", "strength"]
    assert report["matched_columns"]["slag"] == "Blast Furnace Slag"
    assert report["rows_out"] == 200


def test_parse_rejects_missing_columns():
    bad = b"foo,bar\n1,2\n3,4\n"
    with pytest.raises(dataset_io.DatasetError):
        dataset_io.parse_and_validate(bad, "bad.csv")


def test_parse_rejects_unsupported_type(industry_csv):
    with pytest.raises(dataset_io.DatasetError):
        dataset_io.parse_and_validate(industry_csv, "data.txt")


# ── Store / scopes ────────────────────────────────────────────────────────────
def test_user_upload_persists_to_disk(industry_csv):
    df, _ = dataset_io.parse_and_validate(industry_csv, "data.csv")
    ws, sid = store.set_uploaded(df, "data.csv", user_id=TEST_USER, mode="replace")
    assert sid is None  # persistent users don't get a session id
    assert ws.scope_id == f"user:{TEST_USER}"
    assert os.path.isdir(store._user_dir(TEST_USER))
    # Resolves from a cleared in-memory cache (i.e. from disk).
    store._users.clear()
    assert store.resolve(user_id=TEST_USER).source.startswith("Uploaded")


def test_combine_mode_augments_uci():
    # Distinct rows (not a UCI subset) so dedup keeps them.
    base = data.load_default().head(150).copy()
    base["strength"] = base["strength"] + 0.123  # make each row unique vs UCI
    base.columns = [
        "Cement", "Blast Furnace Slag", "Fly Ash", "Water", "Superplasticizer",
        "Coarse Aggregate", "Fine Aggregate", "Age (day)", "Concrete Compressive Strength",
    ]
    buf = io.StringIO()
    base.to_csv(buf, index=False)
    df, _ = dataset_io.parse_and_validate(buf.getvalue().encode(), "data.csv")
    ws, _ = store.set_uploaded(df, "data.csv", user_id=TEST_USER, mode="combine")
    assert len(ws.df) > 1030  # UCI baseline + 150 new rows
    assert "UCI +" in ws.source


def test_anonymous_upload_is_temporary(industry_csv):
    df, _ = dataset_io.parse_and_validate(industry_csv, "data.csv")
    ws, sid = store.set_uploaded(df, "data.csv", session_id=None, mode="replace")
    assert sid is not None
    assert store.resolve(session_id=sid).source.startswith("Uploaded")
    # Not written to disk.
    assert not os.path.isdir(os.path.join(store.USERS_DIR, sid))


def test_reset_reverts_to_default(industry_csv):
    df, _ = dataset_io.parse_and_validate(industry_csv, "data.csv")
    store.set_uploaded(df, "data.csv", user_id=TEST_USER)
    store.reset(user_id=TEST_USER)
    assert store.resolve(user_id=TEST_USER).scope_id == "default"


# ── Optimizer ─────────────────────────────────────────────────────────────────
def test_optimizer_front_constraint_compliant():
    ws = store.default_workspace()
    res = optimizer.optimize(ws, 50, 30, 20, min_strength=30)
    assert res["best_mix"] is not None and res["stats"]["pareto_count"] > 0
    front = [m for m in res["mixes"] if m["is_pareto"]]
    assert all(m["Strength (MPa)"] >= 30 - 1e-6 for m in front)
    for m in front:
        wc = m["Water (L)"] / m["Cement (kg)"]
        assert config.WC_MIN - 1e-3 <= wc <= config.WC_MAX + 1e-3


def test_optimizer_caches_per_scope():
    optimizer.clear_cache()
    ws = store.default_workspace()
    optimizer.optimize(ws, 50, 30, 20, min_strength=25)
    n = len(optimizer._cache)
    optimizer.optimize(ws, 90, 5, 5, min_strength=25)  # same scope+constraints, diff weights
    assert len(optimizer._cache) == n  # no recompute


# ── API ───────────────────────────────────────────────────────────────────────
def test_health_endpoint():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["model"]["r2"] > 0.85


def test_dataset_endpoint_default():
    r = client.get("/api/dataset")
    assert r.status_code == 200
    assert r.json()["n_samples"] == 1030
    assert "source" in r.json()


def test_optimize_backward_compatible_shape():
    r = client.post("/api/optimize", json={"w_co2": 50, "w_cost": 30, "w_str": 20, "min_strength": 25})
    assert r.status_code == 200
    d = r.json()
    for key in ("feasible_count", "total_count", "mixes", "pareto_indices", "best_mix", "stats"):
        assert key in d
    m = d["mixes"][0]
    for key in ("CO2 (kg/m3)", "Cost ($/m3)", "Strength (MPa)", "Cement (kg)",
                "Slag (kg)", "Water (L)", "Fly Ash (kg)"):
        assert key in m


def test_optimize_rejects_zero_weights():
    r = client.post("/api/optimize", json={"w_co2": 0, "w_cost": 0, "w_str": 0})
    assert r.status_code == 422


def test_predict_endpoint():
    r = client.post("/api/predict", json={"cement": 350, "water": 175, "coarse_agg": 1000, "fine_agg": 760})
    assert r.status_code == 200 and 0 < r.json()["strength"] < 120


def test_upload_endpoint_and_scoped_optimize(industry_csv):
    # Upload to a user scope
    r = client.post(
        "/api/dataset/upload",
        files={"file": ("industry.csv", industry_csv, "text/csv")},
        data={"user_id": TEST_USER, "mode": "replace"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["validation_report"]["rows_out"] == 200
    assert body["model"]["r2"] > 0.5
    assert body["source"].startswith("Uploaded")

    # Dataset endpoint now reflects the uploaded data for that user
    r2 = client.get(f"/api/dataset?user_id={TEST_USER}")
    assert r2.json()["n_samples"] == 200
    assert r2.json()["source"].startswith("Uploaded")

    # Optimize uses the user's scope
    r3 = client.post("/api/optimize", json={"w_co2": 50, "w_cost": 30, "w_str": 20,
                                            "min_strength": 25, "user_id": TEST_USER})
    assert r3.status_code == 200 and r3.json()["source"].startswith("Uploaded")

    # Reset reverts to default
    r4 = client.post("/api/dataset/reset", json={"user_id": TEST_USER})
    assert r4.status_code == 200
    assert client.get(f"/api/dataset?user_id={TEST_USER}").json()["n_samples"] == 1030


def test_upload_invalid_file_returns_400():
    r = client.post(
        "/api/dataset/upload",
        files={"file": ("bad.csv", b"foo,bar\n1,2\n", "text/csv")},
        data={"user_id": TEST_USER},
    )
    assert r.status_code == 400
