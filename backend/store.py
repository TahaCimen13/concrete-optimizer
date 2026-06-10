"""Scope resolution, persistence and caching for active datasets/models.

A Workspace bundles everything an optimization needs: the active dataset, the
variable bounds, the trained model and its metrics, and a human-readable source.

Scopes:
  - default            → immutable UCI dataset + model (always available)
  - user:<user_id>     → persisted on disk (survives restarts)
  - anon:<session_id>  → in-memory only (temporary; lost on restart)

Identity is supplied by the frontend (user_id from the NextAuth session). This
is trusted for the project's scope; JWT verification could be added later.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from dataclasses import dataclass

import joblib
import pandas as pd

import config
import data
import model as model_mod

_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_DIR = os.path.join(_DIR, "storage", "users")

_SAFE = re.compile(r"[^A-Za-z0-9_-]")


@dataclass
class Workspace:
    scope_id: str          # "default" | "user:<id>" | "anon:<id>"
    source: str            # human-readable description
    df: pd.DataFrame
    bounds: dict
    model: object
    metrics: dict


# In-memory caches
_default_ws: Workspace | None = None
_users: dict[str, Workspace] = {}   # user_id -> Workspace
_anon: dict[str, Workspace] = {}    # session_id -> Workspace


def _sanitize(scope: str) -> str:
    s = _SAFE.sub("", scope or "")
    return s[:64]


def _user_dir(user_id: str) -> str:
    return os.path.join(USERS_DIR, _sanitize(user_id))


def _make_workspace(scope_id: str, source: str, df: pd.DataFrame, m, metrics) -> Workspace:
    return Workspace(
        scope_id=scope_id,
        source=source,
        df=df,
        bounds=data.feature_bounds(df),
        model=m,
        metrics=metrics,
    )


def default_workspace() -> Workspace:
    global _default_ws
    if _default_ws is None:
        m, metrics = model_mod.default_model()
        _default_ws = _make_workspace(
            "default", f"UCI default — {config.DATASET_CITATION.split('.')[0]}",
            data.load_default(), m, metrics,
        )
    return _default_ws


def _load_user_from_disk(user_id: str) -> Workspace | None:
    d = _user_dir(user_id)
    csv, mdl, met = (os.path.join(d, f) for f in ("dataset.csv", "model.joblib", "metrics.json"))
    if not (os.path.exists(csv) and os.path.exists(mdl) and os.path.exists(met)):
        return None
    df = pd.read_csv(csv)
    m = joblib.load(mdl)
    with open(met) as f:
        metrics = json.load(f)
    src = metrics.get("source", "uploaded dataset")
    return _make_workspace(f"user:{user_id}", src, df, m, metrics)


def resolve(user_id: str | None = None, session_id: str | None = None) -> Workspace:
    """Return the active Workspace for the given identity, else the default."""
    if user_id:
        if user_id in _users:
            return _users[user_id]
        ws = _load_user_from_disk(user_id)
        if ws is not None:
            _users[user_id] = ws
            return ws
    if session_id and session_id in _anon:
        return _anon[session_id]
    return default_workspace()


def new_session_id() -> str:
    return uuid.uuid4().hex


def set_uploaded(
    df: pd.DataFrame,
    filename: str,
    user_id: str | None = None,
    session_id: str | None = None,
    mode: str = "combine",
) -> tuple[Workspace, str | None]:
    """Train on the uploaded df and store it. Returns (workspace, session_id|None).

    mode="combine" → merge the uploaded rows with the default UCI dataset and
    train on both (UCI stays the scientific baseline, augmented with new data).
    mode="replace" → train on the uploaded data only.

    Logged-in users (user_id) → persisted to disk. Otherwise → in-memory (a
    session_id is created if not supplied) and returned to the caller.
    """
    if mode == "combine":
        cols = config.COMPONENTS + ["age", "strength"]
        df = (
            pd.concat([data.load_default()[cols], df[cols]], ignore_index=True)
            .drop_duplicates()
            .reset_index(drop=True)
        )
        source = f"UCI + {filename} (combined, {len(df)} samples)"
    else:
        source = f"Uploaded: {filename} ({len(df)} samples)"

    # Skip CV here — retraining runs inside the upload request, so keep it fast.
    m, metrics = model_mod.train_on(df, with_cv=False)
    metrics = {**metrics, "source": source}

    if user_id:
        scope_id = f"user:{user_id}"
        ws = _make_workspace(scope_id, source, df, m, metrics)
        d = _user_dir(user_id)
        os.makedirs(d, exist_ok=True)
        df.to_csv(os.path.join(d, "dataset.csv"), index=False)
        joblib.dump(m, os.path.join(d, "model.joblib"))
        with open(os.path.join(d, "metrics.json"), "w") as f:
            json.dump(metrics, f, indent=2)
        _users[user_id] = ws
        return ws, None

    sid = session_id or new_session_id()
    ws = _make_workspace(f"anon:{sid}", source, df, m, metrics)
    _anon[sid] = ws
    return ws, sid


def reset(user_id: str | None = None, session_id: str | None = None) -> None:
    """Discard an uploaded dataset, reverting the scope to the default."""
    if user_id:
        _users.pop(user_id, None)
        d = _user_dir(user_id)
        if os.path.isdir(d):
            for f in os.listdir(d):
                os.remove(os.path.join(d, f))
            os.rmdir(d)
    elif session_id:
        _anon.pop(session_id, None)
