"""Pydantic request/response models (validation for the API layer)."""
from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

import config


class OptimizeRequest(BaseModel):
    w_co2: float = Field(default=50, ge=0, le=100)
    w_cost: float = Field(default=30, ge=0, le=100)
    w_str: float = Field(default=20, ge=0, le=100)
    min_strength: float = Field(default=config.DEFAULT_MIN_STRENGTH, ge=0, le=120)
    age: float = Field(default=config.DEFAULT_AGE, gt=0, le=365)
    wc_min: float = Field(default=config.WC_MIN, ge=0.2, le=1.0)
    wc_max: float = Field(default=config.WC_MAX, ge=0.2, le=1.0)
    # Scope: which dataset/model to use (frontend supplies these).
    user_id: str | None = None
    session_id: str | None = None

    @model_validator(mode="after")
    def _check_weights_and_wc(self):
        if self.w_co2 + self.w_cost + self.w_str == 0:
            raise ValueError("At least one objective weight must be greater than zero.")
        if self.wc_min >= self.wc_max:
            raise ValueError("wc_min must be smaller than wc_max.")
        return self


class PredictRequest(BaseModel):
    cement: float = Field(ge=0)
    slag: float = Field(default=0, ge=0)
    fly_ash: float = Field(default=0, ge=0)
    water: float = Field(ge=0)
    superplasticizer: float = Field(default=0, ge=0)
    coarse_agg: float = Field(default=0, ge=0)
    fine_agg: float = Field(default=0, ge=0)
    age: float = Field(default=config.DEFAULT_AGE, gt=0, le=365)
    user_id: str | None = None
    session_id: str | None = None

    def as_mix(self) -> dict:
        return {c: getattr(self, c) for c in config.COMPONENTS}


class ReportRequest(BaseModel):
    name: str | None = None
    w_co2: float = 0
    w_cost: float = 0
    w_str: float = 0
    min_strength: float | None = None
    best_mix: dict | None = None
    user_id: str | None = None
    session_id: str | None = None


class ResetRequest(BaseModel):
    user_id: str | None = None
    session_id: str | None = None
