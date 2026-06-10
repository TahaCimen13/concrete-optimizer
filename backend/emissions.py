"""CO2 emissions and material cost for a concrete mix.

Both are linear in component masses: value = Σ (factor_i × mass_i), using the
literature-based factors and prices in config.py. Inputs are kg/m³.
"""
from __future__ import annotations

from collections.abc import Mapping

import numpy as np

import config


def co2(mix: Mapping[str, float]) -> float:
    """Embodied CO2 of a mix (kg CO2e per m³)."""
    return float(sum(config.CO2_FACTORS[c] * mix.get(c, 0.0) for c in config.COMPONENTS))


def cost(mix: Mapping[str, float]) -> float:
    """Material cost of a mix (currency per m³)."""
    return float(sum(config.PRICES[c] * mix.get(c, 0.0) for c in config.COMPONENTS))


def co2_vec(X: np.ndarray) -> np.ndarray:
    """Vectorized CO2 for an (n, n_components) array, columns ordered as config.COMPONENTS."""
    factors = np.array([config.CO2_FACTORS[c] for c in config.COMPONENTS])
    return X @ factors


def cost_vec(X: np.ndarray) -> np.ndarray:
    """Vectorized cost for an (n, n_components) array, columns ordered as config.COMPONENTS."""
    prices = np.array([config.PRICES[c] for c in config.COMPONENTS])
    return X @ prices
