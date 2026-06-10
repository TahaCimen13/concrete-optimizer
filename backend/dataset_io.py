"""Parse, column-map and validate uploaded concrete-mix datasets.

Industry files arrive as .csv / .xls / .xlsx with varying header names. We
normalize headers and map them to the 9 canonical keys via alias matching, then
validate and clean the data, returning a canonical DataFrame and a report.
"""
from __future__ import annotations

import io
import re

import pandas as pd

import config

# Canonical key → alias fragments (matched against normalized headers).
ALIASES: dict[str, list[str]] = {
    "cement": ["cement"],
    "slag": ["blast furnace slag", "blastfurnaceslag", "slag", "ggbs", "ggbfs"],
    "fly_ash": ["fly ash", "flyash", "fly_ash", "pfa"],
    "water": ["water"],
    "superplasticizer": ["superplasticizer", "super plasticizer", "plasticizer", "admixture", "sp"],
    "coarse_agg": ["coarse aggregate", "coarseaggregate", "coarse agg", "coarse", "gravel"],
    "fine_agg": ["fine aggregate", "fineaggregate", "fine agg", "fine", "sand"],
    "age": ["age"],
    "strength": [
        "concrete compressive strength", "compressive strength", "strength",
        "fck", "fc", "mpa",
    ],
}

REQUIRED = config.COMPONENTS + ["strength"]  # age is optional (defaulted)
MIN_ROWS = 20


class DatasetError(ValueError):
    """Raised when an uploaded file cannot be parsed/validated."""


def _normalize(header: str) -> str:
    """Lowercase, drop parenthetical units/notes and punctuation, collapse spaces."""
    h = str(header).lower()
    h = re.sub(r"\(.*?\)", " ", h)        # remove (component 1)(kg ...) etc.
    h = re.sub(r"[^a-z0-9 ]", " ", h)     # drop punctuation/symbols
    h = re.sub(r"\s+", " ", h).strip()
    return h


def _read_any(content: bytes, filename: str) -> pd.DataFrame:
    name = (filename or "").lower()
    if name.endswith(".csv"):
        return pd.read_csv(io.BytesIO(content))
    if name.endswith(".xlsx"):
        return pd.read_excel(io.BytesIO(content), engine="openpyxl")
    if name.endswith(".xls"):
        import xlrd  # xlrd 1.2 reads legacy .xls
        book = xlrd.open_workbook(file_contents=content)
        sheet = book.sheet_by_index(0)
        rows = [sheet.row_values(r) for r in range(sheet.nrows)]
        return pd.DataFrame(rows[1:], columns=rows[0])
    raise DatasetError("Unsupported file type. Upload a .csv, .xls or .xlsx file.")


def _map_columns(df: pd.DataFrame) -> tuple[dict[str, str], list[str]]:
    """Return {canonical_key: original_column} and the list of unmatched required keys."""
    normalized = {col: _normalize(col) for col in df.columns}
    mapping: dict[str, str] = {}
    for key in ALIASES:
        for col, norm in normalized.items():
            if col in mapping.values():
                continue
            if any(norm == a or a in norm.split() or norm.startswith(a) or a in norm
                   for a in ALIASES[key]):
                mapping[key] = col
                break
    missing = [k for k in REQUIRED if k not in mapping]
    return mapping, missing


def parse_and_validate(content: bytes, filename: str) -> tuple[pd.DataFrame, dict]:
    """Parse an uploaded file into a canonical, cleaned DataFrame + a report.

    Raises DatasetError on unrecoverable problems (bad format, missing columns,
    too few valid rows).
    """
    raw = _read_any(content, filename)
    if raw.empty:
        raise DatasetError("The uploaded file contains no data rows.")

    mapping, missing = _map_columns(raw)
    if missing:
        raise DatasetError(
            "Could not find required column(s): "
            + ", ".join(missing)
            + ". Expected mix components (cement, slag, fly ash, water, "
            "superplasticizer, coarse/fine aggregate) and compressive strength."
        )

    n_in = int(len(raw))
    warnings: list[str] = []

    # Build canonical frame.
    df = pd.DataFrame()
    for key, col in mapping.items():
        df[key] = pd.to_numeric(raw[col], errors="coerce")
    if "age" not in df.columns:
        df["age"] = config.DEFAULT_AGE
        warnings.append(f"No age column found; defaulted all rows to {config.DEFAULT_AGE} days.")

    # Drop rows with nulls (non-numeric or missing) in required + age.
    needed = REQUIRED + ["age"]
    before = len(df)
    df = df.dropna(subset=needed)
    dropped_nulls = before - len(df)

    # Drop physically impossible negatives.
    before = len(df)
    df = df[(df[config.COMPONENTS] >= 0).all(axis=1) & (df["strength"] > 0)]
    dropped_negatives = before - len(df)

    if len(df) < MIN_ROWS:
        raise DatasetError(
            f"Only {len(df)} valid rows after cleaning (need ≥ {MIN_ROWS}). "
            "Check the file's numeric columns."
        )

    # Out-of-typical-range warnings (informational, rows kept).
    if df["strength"].max() > 150:
        warnings.append("Some strength values exceed 150 MPa — verify units (MPa expected).")
    if (df["water"] / df["cement"].replace(0, pd.NA)).max() > 1.5:
        warnings.append("Very high water/cement ratios detected — verify the data.")

    df = df[config.COMPONENTS + ["age", "strength"]].reset_index(drop=True)

    report = {
        "matched_columns": {k: str(v) for k, v in mapping.items()},
        "rows_in": n_in,
        "rows_out": int(len(df)),
        "dropped_nulls": int(dropped_nulls),
        "dropped_negatives": int(dropped_negatives),
        "warnings": warnings,
    }
    return df, report
