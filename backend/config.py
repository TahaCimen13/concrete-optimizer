"""Domain constants for ConcreteDSS.

All emission factors and unit prices are literature/market-based and indicative;
they are centralised here so they can be cited and adjusted. References are noted
inline. Quantities are per cubic metre of concrete (kg/m³), matching the UCI
Concrete Compressive Strength dataset (Yeh, 1998).
"""
from __future__ import annotations

# Mix component keys (internal snake_case) and their dataset columns.
COMPONENTS = ["cement", "slag", "fly_ash", "water", "superplasticizer", "coarse_agg", "fine_agg"]
DESIGN_VARS = COMPONENTS  # decision variables for the optimizer (age fixed)

# ── CO2 global-warming-potential factors (kg CO2e per kg of material) ──────────
# Primary source: Hammond & Jones, Inventory of Carbon & Energy (ICE) v3.0,
# University of Bath; cross-checked with Flower & Sanjayan (2007) and EFCA EPDs.
# Values are mid-range, indicative figures.
CO2_FACTORS = {
    "cement": 0.90,            # CEM I Portland cement (ICE: 0.83–0.93)
    "slag": 0.10,              # GGBS (ICE: 0.067–0.13)
    "fly_ash": 0.01,           # PFA (ICE: 0.004–0.027)
    "water": 0.0003,           # treated/tap water
    "superplasticizer": 1.50,  # EFCA EPD (0.72–1.88)
    "coarse_agg": 0.0075,      # crushed gravel (ICE: 0.0048–0.046)
    "fine_agg": 0.0026,        # natural sand (ICE: 0.0026–0.026)
}

# ── Unit prices (USD per kg) — indicative market values, adjustable ───────────
# Currency: USD. To localise (e.g. TRY), multiply by an exchange rate here.
CURRENCY = "USD"
PRICES = {
    "cement": 0.10,
    "slag": 0.05,
    "fly_ash": 0.03,
    "water": 0.0005,
    "superplasticizer": 2.00,
    "coarse_agg": 0.012,
    "fine_agg": 0.010,
}

# ── Engineering constraints (from the project's mathematical framework, EN 206) ─
WC_MIN = 0.30              # water-to-cement ratio lower bound (durability)
WC_MAX = 0.65             # water-to-cement ratio upper bound (workability)
BINDER_MIN = 260.0        # min total binder (cement + slag + fly_ash) kg/m³
BINDER_MAX = 550.0        # max total binder kg/m³
DENSITY_MIN = 2200.0      # plausible fresh concrete density window (kg/m³)
DENSITY_MAX = 2600.0
DEFAULT_MIN_STRENGTH = 25.0   # MPa (EN 206 C25/30 structural class)
DEFAULT_AGE = 28              # days (standard characteristic strength age)

# ── UCI dataset ───────────────────────────────────────────────────────────────
DATASET_URL = (
    "https://archive.ics.uci.edu/ml/machine-learning-databases/"
    "concrete/compressive/Concrete_Data.xls"
)
DATASET_CITATION = (
    "Yeh, I-C. (1998). Modeling of strength of high-performance concrete using "
    "artificial neural networks. Cement and Concrete Research, 28(12), 1797-1808. "
    "UCI Machine Learning Repository."
)
