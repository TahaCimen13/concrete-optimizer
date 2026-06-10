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


def _rows_from_arrays(comps: np.ndarray, strength: np.ndarray, ages, is_pareto: bool) -> list[dict]:
    """Build mix dicts from arrays — emissions are vectorized (no per-row model calls)."""
    if comps.shape[0] == 0:
        return []
    co2 = emissions.co2_vec(comps)
    cost = emissions.cost_vec(comps)
    age_arr = np.full(comps.shape[0], ages) if np.isscalar(ages) else ages
    rows = []
    for i in range(comps.shape[0]):
        d = {DISPLAY[c]: round(float(comps[i, j]), 1) for j, c in enumerate(config.COMPONENTS)}
        d.update({
            "CO2 (kg/m3)": round(float(co2[i]), 2),
            "Cost ($/m3)": round(float(cost[i]), 2),
            "Strength (MPa)": round(float(strength[i]), 2),
            "Age (day)": float(age_arr[i]),
            "is_pareto": is_pareto,
        })
        rows.append(d)
    return rows


def _real_feasible(ws, age, min_strength, wc_min, wc_max) -> list[dict]:
    """Active-dataset mixes (at the given age) satisfying the constraints (vectorized)."""
    df = ws.df
    sub = df[df["age"] == age]
    if len(sub) < 20:
        sub = df

    comps = sub[config.COMPONENTS].to_numpy()
    cement = comps[:, I["cement"]]
    water = comps[:, I["water"]]
    binder = cement + comps[:, I["slag"]] + comps[:, I["fly_ash"]]
    density = comps.sum(axis=1)
    strength = sub["strength"].to_numpy()
    ages = sub["age"].to_numpy()
    with np.errstate(divide="ignore", invalid="ignore"):
        wc = np.where(cement > 0, water / cement, np.inf)

    mask = (
        (cement > 0)
        & (wc >= wc_min) & (wc <= wc_max)
        & (binder >= config.BINDER_MIN) & (binder <= config.BINDER_MAX)
        & (density >= config.DENSITY_MIN) & (density <= config.DENSITY_MAX)
        & (strength >= min_strength)
    )
    return _rows_from_arrays(comps[mask], strength[mask], ages[mask], is_pareto=False)


def _run_nsga(ws, age, min_strength, wc_min, wc_max, pop=80, n_gen=40) -> list[dict]:
    xl = np.array([ws.bounds[c][0] for c in config.COMPONENTS])
    xu = np.array([ws.bounds[c][1] for c in config.COMPONENTS])
    problem = ConcreteProblem(xl, xu, ws.model, age, min_strength, wc_min, wc_max)
    res = minimize(problem, NSGA2(pop_size=pop), ("n_gen", n_gen), seed=42, verbose=False)
    if res.X is None:
        return []
    X = np.atleast_2d(res.X)
    strength = model_mod.predict_batch(ws.model, X, age)  # one batched prediction
    return _rows_from_arrays(X, strength, age, is_pareto=True)


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
