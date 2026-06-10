"use client";

import type { OptimizeResult } from "@/lib/api";

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div className="text-2xl font-extrabold tabular-nums text-[var(--primary)]">
        {value}
        {unit && (
          <span className="ml-1 text-xs font-medium text-[var(--text-muted)]">{unit}</span>
        )}
      </div>
    </div>
  );
}

export default function StatsStrip({ result }: { result: OptimizeResult | null }) {
  const best = result?.best_mix;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Feasible Mixes"
        value={result ? String(result.feasible_count) : "—"}
        unit={result ? `/ ${result.total_count}` : ""}
      />
      <Stat
        label="Pareto-optimal"
        value={result?.stats ? String(result.stats.pareto_count) : "—"}
        unit="mixes"
      />
      <Stat
        label="Best CO₂"
        value={best ? best["CO2 (kg/m3)"].toFixed(0) : "—"}
        unit="kg/m³"
      />
      <Stat
        label="Best Strength"
        value={best ? best["Strength (MPa)"].toFixed(0) : "—"}
        unit="MPa"
      />
    </div>
  );
}
