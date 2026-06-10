"""Default (UCI) dataset loading and dataset-level helpers.

The UCI Concrete Compressive Strength dataset (Yeh, 1998) is the immutable
default. Uploaded datasets are handled by dataset_io.py + store.py; the helpers
here (feature_bounds, dataset_summary) take a DataFrame so they work for any
active dataset, not just the default.
"""
from __future__ import annotations

import os
import urllib.request

import pandas as pd

import config

_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_DIR, "data")
CSV_PATH = os.path.join(DATA_DIR, "concrete.csv")
XLS_PATH = os.path.join(DATA_DIR, "Concrete_Data.xls")

# Clean snake_case keys (by column position) for the default .xls.
COLUMNS = [
    "cement", "slag", "fly_ash", "water", "superplasticizer",
    "coarse_agg", "fine_agg", "age", "strength",
]

_default_cache: pd.DataFrame | None = None


def _download_and_convert() -> pd.DataFrame:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(XLS_PATH):
        urllib.request.urlretrieve(config.DATASET_URL, XLS_PATH)

    # pandas 3 + xlrd 2 dropped .xls; read legacy .xls with xlrd 1.2 directly.
    import xlrd

    book = xlrd.open_workbook(XLS_PATH)
    sheet = book.sheet_by_index(0)
    rows = [sheet.row_values(r) for r in range(sheet.nrows)]
    df = pd.DataFrame(rows[1:], columns=COLUMNS).astype(float)
    df.to_csv(CSV_PATH, index=False)
    return df


def load_default() -> pd.DataFrame:
    """Return the immutable default UCI dataset (cached in memory, then on disk)."""
    global _default_cache
    if _default_cache is not None:
        return _default_cache
    if os.path.exists(CSV_PATH):
        _default_cache = pd.read_csv(CSV_PATH)
    else:
        _default_cache = _download_and_convert()
    return _default_cache


def feature_bounds(df: pd.DataFrame) -> dict[str, tuple[float, float]]:
    """Per-component (min, max) ranges — used as optimizer variable bounds."""
    return {c: (float(df[c].min()), float(df[c].max())) for c in config.COMPONENTS}


def dataset_summary(df: pd.DataFrame) -> dict:
    """Summary statistics for the EDA / transparency endpoint."""
    cols = config.COMPONENTS + ["age", "strength"]
    return {
        "n_samples": int(len(df)),
        "features": {
            c: {
                "min": round(float(df[c].min()), 2),
                "max": round(float(df[c].max()), 2),
                "mean": round(float(df[c].mean()), 2),
            }
            for c in cols
        },
    }
