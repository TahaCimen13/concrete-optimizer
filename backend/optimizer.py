"""Multi-objective mix optimization via NSGA-II (pymoo).

Generates NEW concrete mix designs on the true Pareto front for three competing
objectives — minimize CO2, minimize cost, maximize ML-predicted strength —
subject to engineering constraints (w/c ratio, binder content, density, minimum
strength). The active dataset's mixes that satisfy the same constraints are
returned as a background cloud for comparison.

Everything operates on a Workspace (active dataset + model + bounds), so each
scope (default / per-user / anonymous) optimizes against its own data. The front
depends only on the CONSTRAINTS, so results are cached per (scope, constraints);
changing the objective weights only re-runs the cheap weighted-sum selection.
"""
from __future__ import annotations

import numpy as np
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.core.problem import Problem
from pymoo.optimize import minimize

import config
import emissions
import model as model_mod
import scoring

I = {c: i for i, c in enumerate(config.COMPONENTS)}

DISPLAY = {
    "cement": "Cement (kg)",
    "slag": "Slag (kg)",
    "fly_ash": "Fly Ash (kg)",
    "water": "Water (L)",
    "superplasticizer": "Superplasticizer (kg)",
    "coarse_agg": "Coarse Agg (kg)",
    "fine_agg": "Fine Agg (kg)",
}

# Cache keyed by (scope_id, constraint signature) → {"front", "real"}
_cache: dict[tuple, dict] = {}


class ConcreteProblem(Problem):
    def __init__(self, xl, xu, model, age, min_strength, wc_min, wc_max):
        super().__init__(n_var=len(config.COMPONENTS), n_obj=3, n_ieq_constr=7, xl=xl, xu=xu)
        self.model = model
        self.age = age
        self.min_strength = min_strength
        self.wc_min = wc_min
        self.wc_max = wc_max

    def _evaluate(self, X, out, *args, **kwargs):
        co2 = emissions.co2_vec(X)
        cost = emissions.cost_vec(X)
        strength = model_mod.predict_batch(self.model, X, self.age)
        out["F"] = np.column_stack([co2, cost, -strength])

        cement = X[:, I["cement"]]
        water = X[:, I["water"]]
        binder = cement + X[:, I["slag"]] + X[:, I["fly_ash"]]
        density = X.sum(axis=1)

        out["G"] = np.column_stack([
            self.wc_min * cement - water,
            water - self.wc_max * cement,
            config.BINDER_MIN - binder,
            binder - config.BINDER_MAX,
            config.DENSITY_MIN - density,
            density - config.DENSITY_MAX,
            self.min_strength - strength,
        ])


def _build_mix(model, comps: np.ndarray, age: float, is_pareto: bool) -> dict:
    mix = {c: float(comps[I[c]]) for c in config.COMPONENTS}
    d = {DISPLAY[c]: round(mix[c], 1) for c in config.COMPONENTS}
    d.update({
        "CO2 (kg/m3)": round(emissions.co2(mix), 2),
        "Cost ($/m3)": round(emissions.cost(mix), 2),
        "Strength (MPa)": round(model_mod.predict_one(model, mix, age), 2),
        "Age (day)": age,
        "is_pareto": is_pareto,
    })
    return d


def _real_feasible(ws, age, min_strength, wc_min, wc_max) -> list[dict]:
    """Active-dataset mixes (at the given age) satisfying the constraints."""
    df = ws.df
    sub = df[df["age"] == age]
    if len(sub) < 20:
        sub = df
    rows = []
    for _, r in sub.iterrows():
        cement, water = r["cement"], r["water"]
        if cement <= 0:
            continue
        wc = water / cement
        binder = cement + r["slag"] + r["fly_ash"]
        density = sum(r[c] for c in config.COMPONENTS)
        if not (wc_min <= wc <= wc_max):
            continue
        if not (config.BINDER_MIN <= binder <= config.BINDER_MAX):
            continue
        if not (config.DENSITY_MIN <= density <= config.DENSITY_MAX):
            continue
        if r["strength"] < min_strength:
            continue
        mix = {c: float(r[c]) for c in config.COMPONENTS}
        d = {DISPLAY[c]: round(mix[c], 1) for c in config.COMPONENTS}
        d.update({
            "CO2 (kg/m3)": round(emissions.co2(mix), 2),
            "Cost ($/m3)": round(emissions.cost(mix), 2),
            "Strength (MPa)": round(float(r["strength"]), 2),
            "Age (day)": float(r["age"]),
            "is_pareto": False,
        })
        rows.append(d)
    return rows


def _run_nsga(ws, age, min_strength, wc_min, wc_max, pop=100, n_gen=60) -> list[dict]:
    xl = np.array([ws.bounds[c][0] for c in config.COMPONENTS])
    xu = np.array([ws.bounds[c][1] for c in config.COMPONENTS])
    problem = ConcreteProblem(xl, xu, ws.model, age, min_strength, wc_min, wc_max)
    res = minimize(problem, NSGA2(pop_size=pop), ("n_gen", n_gen), seed=42, verbose=False)
    if res.X is None:
        return []
    X = np.atleast_2d(res.X)
    return [_build_mix(ws.model, X[i], age, True) for i in range(X.shape[0])]


def _compute(ws, age, min_strength, wc_min, wc_max) -> dict:
    return {
        "front": _run_nsga(ws, age, min_strength, wc_min, wc_max),
        "real": _real_feasible(ws, age, min_strength, wc_min, wc_max),
    }


def optimize(
    ws,
    w_co2: float,
    w_cost: float,
    w_str: float,
    min_strength: float = config.DEFAULT_MIN_STRENGTH,
    age: float = config.DEFAULT_AGE,
    wc_min: float = config.WC_MIN,
    wc_max: float = config.WC_MAX,
) -> dict:
    key = (ws.scope_id, round(min_strength, 1), float(age), round(wc_min, 2), round(wc_max, 2))
    if key not in _cache:
        _cache[key] = _compute(ws, age, min_strength, wc_min, wc_max)

    cached = _cache[key]
    front, real = cached["front"], cached["real"]

    total = len(ws.df)
    mixes = real + front
    pareto_positions = list(range(len(real), len(real) + len(front)))

    base = {
        "feasible_count": len(real),
        "total_count": int(total),
        "mixes": mixes,
        "pareto_indices": pareto_positions,
        "source": ws.source,
    }

    if not front:
        return {**base, "best_mix": None, "stats": None}

    co2 = np.array([m["CO2 (kg/m3)"] for m in front])
    cost = np.array([m["Cost ($/m3)"] for m in front])
    strength = np.array([m["Strength (MPa)"] for m in front])
    bi = scoring.best_index(co2, cost, strength, w_co2, w_cost, w_str)
    best = dict(front[bi])
    best["score"] = round(
        float(scoring.weighted_scores(co2, cost, strength, w_co2, w_cost, w_str)[bi]), 4
    )

    stats = {
        "min_co2": float(co2.min()),
        "min_cost": float(cost.min()),
        "max_strength": float(strength.max()),
        "pareto_count": len(front),
        "real_feasible_count": len(real),
    }
    return {**base, "best_mix": best, "stats": stats}


def clear_cache(scope_id: str | None = None) -> None:
    """Invalidate cached fronts (all, or for one scope after a dataset change)."""
    if scope_id is None:
        _cache.clear()
    else:
        for k in [k for k in _cache if k[0] == scope_id]:
            del _cache[k]
