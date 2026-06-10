"""ML compressive-strength predictor.

A HistGradientBoostingRegressor predicts strength (MPa) from the 7 mix components
plus age. It is much faster to train than the classic GradientBoosting (important
because uploaded datasets retrain on the fly, behind a request), with comparable
accuracy. `train_on(df)` trains+evaluates on any dataset; the prediction helpers
take an explicit model so different scopes can use different models.
"""
from __future__ import annotations

import json
import os

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split

import config
import data

_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "strength.joblib")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")

MODEL_FEATURES = config.COMPONENTS + ["age"]  # 8 features, fixed order

_default = None  # (model, metrics) for the UCI default, cached


def _build() -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        max_iter=400, learning_rate=0.08, max_depth=6, random_state=42,
    )


def train_on(df, with_cv: bool = True) -> tuple[HistGradientBoostingRegressor, dict]:
    """Train, evaluate (hold-out, optional 5-fold CV), and refit on full data.

    with_cv=False skips the 5-fold cross-validation (5 extra model fits) so that
    on-the-fly retraining after an upload stays fast enough to finish within the
    request/proxy timeout. The default UCI model (built offline) keeps with_cv=True.
    """
    X = df[MODEL_FEATURES].to_numpy()
    y = df["strength"].to_numpy()

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    evaluator = _build().fit(X_tr, y_tr)
    pred = evaluator.predict(X_te)

    metrics = {
        "r2": round(float(r2_score(y_te, pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_te, pred))), 3),
        "mae": round(float(mean_absolute_error(y_te, pred)), 3),
        "n_samples": int(len(df)),
        "model": "HistGradientBoostingRegressor",
        "features": MODEL_FEATURES,
    }

    if with_cv:
        # Dataset rows may be ordered; shuffle the CV folds.
        kf = KFold(n_splits=5, shuffle=True, random_state=42)
        cv_r2 = cross_val_score(_build(), X, y, cv=kf, scoring="r2")
        metrics["cv_r2_mean"] = round(float(cv_r2.mean()), 4)
        metrics["cv_r2_std"] = round(float(cv_r2.std()), 4)

    model = _build().fit(X, y)  # production model: full data
    return model, metrics


def default_model() -> tuple[HistGradientBoostingRegressor, dict]:
    """The UCI-trained model, cached in memory and on disk."""
    global _default
    if _default is not None:
        return _default
    if os.path.exists(MODEL_PATH) and os.path.exists(METRICS_PATH):
        model = joblib.load(MODEL_PATH)
        with open(METRICS_PATH) as f:
            metrics = json.load(f)
    else:
        model, metrics = train_on(data.load_default())
        os.makedirs(MODEL_DIR, exist_ok=True)
        joblib.dump(model, MODEL_PATH)
        with open(METRICS_PATH, "w") as f:
            json.dump(metrics, f, indent=2)
    _default = (model, metrics)
    return _default


def predict_batch(model, components: np.ndarray, age: float = config.DEFAULT_AGE) -> np.ndarray:
    """Predict strength for an (n, 7) component array at a fixed age."""
    ages = np.full((components.shape[0], 1), age)
    X = np.hstack([components, ages])
    return model.predict(X)


def predict_one(model, mix: dict, age: float | None = None) -> float:
    """Predict strength (MPa) for a single mix dict."""
    comps = np.array([[mix.get(c, 0.0) for c in config.COMPONENTS]])
    a = age if age is not None else mix.get("age", config.DEFAULT_AGE)
    return float(predict_batch(model, comps, a)[0])
