"""Weighted-sum selection of a recommended mix from the Pareto front.

Implements the project's mathematical framework:
  Eq. 2  Min-Max normalization
  Eq. 1  Weighted Sum objective  F = w1·f_CO2 + w2·f_Cost − w3·f_Strength

Operates on objective arrays (CO2, Cost, Strength) so it is independent of how
the candidate mixes were produced (NSGA-II front or dataset).
"""
from __future__ import annotations

import numpy as np


def _normalize(v: np.ndarray) -> np.ndarray:
    """Eq. 2 — scale to [0, 1]; zeros if the range is degenerate."""
    lo, hi = v.min(), v.max()
    span = hi - lo
    if span == 0:
        return np.zeros_like(v)
    return (v - lo) / span


def weighted_scores(
    co2: np.ndarray,
    cost: np.ndarray,
    strength: np.ndarray,
    w_co2: float,
    w_cost: float,
    w_str: float,
) -> np.ndarray:
    """Eq. 1 — composite objective F per candidate (lower is better)."""
    total = w_co2 + w_cost + w_str
    if total == 0:
        w_co2 = w_cost = w_str = 1 / 3
    else:
        w_co2, w_cost, w_str = w_co2 / total, w_cost / total, w_str / total

    return (
        w_co2 * _normalize(co2)
        + w_cost * _normalize(cost)
        - w_str * _normalize(strength)
    )


def best_index(
    co2: np.ndarray,
    cost: np.ndarray,
    strength: np.ndarray,
    w_co2: float,
    w_cost: float,
    w_str: float,
) -> int:
    """Index of the recommended (minimum-F) candidate."""
    return int(np.argmin(weighted_scores(co2, cost, strength, w_co2, w_cost, w_str)))
