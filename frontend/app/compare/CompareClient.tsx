"use client";

import { useEffect, useMemo, useState } from "react";
import ScenarioList from "@/components/ScenarioList";
import type { Scenario } from "@/lib/api";

const ROWS: { label: string; get: (s: Scenario) => string }[] = [
  { label: "CO₂ Weight", get: (s) => String(s.wCo2) },
  { label: "Cost Weight", get: (s) => String(s.wCost) },
  { label: "Strength Weight", get: (s) => String(s.wStr) },
  { label: "Min Strength (MPa)", get: (s) => String(s.minStrength) },
  {
    label: "Best CO₂ (kg/m³)",
    get: (s) => (s.bestMix ? s.bestMix["CO2 (kg/m3)"].toFixed(1) : "—"),
  },
  {
    label: "Best Cost ($/m³)",
    get: (s) => (s.bestMix ? s.bestMix["Cost ($/m3)"].toFixed(1) : "—"),
  },
  {
    label: "Best Strength (MPa)",
    get: (s) => (s.bestMix ? s.bestMix["Strength (MPa)"].toFixed(1) : "—"),
  },
  {
    label: "Cement (kg)",
    get: (s) => (s.bestMix ? s.bestMix["Cement (kg)"].toFixed(0) : "—"),
  },
  {
    label: "Fly Ash (kg)",
    get: (s) => (s.bestMix ? s.bestMix["Fly Ash (kg)"].toFixed(0) : "—"),
  },
];

export default function CompareClient() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/scenarios");
        if (res.ok) {
          const data = await res.json();
          setScenarios(data.scenarios);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
    if (res.ok) {
      setScenarios((prev) => prev.filter((s) => s.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const chosen = useMemo(
    () => scenarios.filter((s) => selected.has(s.id)),
    [scenarios, selected],
  );

  // Highlight the best (lowest CO₂ / cost, highest strength) per row.
  const bestInRow = (label: string): number | null => {
    if (chosen.length < 2) return null;
    const vals = chosen.map((s) => {
      const m = s.bestMix;
      if (!m) return NaN;
      if (label === "Best Strength (MPa)") return m["Strength (MPa)"];
      if (label === "Best CO₂ (kg/m³)") return m["CO2 (kg/m3)"];
      if (label === "Best Cost ($/m³)") return m["Cost ($/m3)"];
      return NaN;
    });
    if (vals.some(Number.isNaN)) return null;
    const wantMax = label === "Best Strength (MPa)";
    let idx = 0;
    vals.forEach((v, i) => {
      if (wantMax ? v > vals[idx] : v < vals[idx]) idx = i;
    });
    return idx;
  };

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <ScenarioList
        scenarios={scenarios}
        onDelete={handleDelete}
        selectable
        selectedIds={selected}
        onToggleSelect={toggle}
      />

      {chosen.length >= 2 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--primary)] text-white">
                <th className="px-4 py-3 text-left font-semibold">Metric</th>
                {chosen.map((s) => (
                  <th key={s.id} className="px-4 py-3 text-left font-semibold">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, ri) => {
                const best = bestInRow(row.label);
                return (
                  <tr
                    key={row.label}
                    className={ri % 2 ? "bg-[var(--surface-2)]" : ""}
                  >
                    <td className="px-4 py-2.5 font-medium text-[var(--text-muted)]">
                      {row.label}
                    </td>
                    {chosen.map((s, ci) => (
                      <td
                        key={s.id}
                        className={`px-4 py-2.5 text-[var(--text)] ${
                          best === ci
                            ? "font-bold text-green-600 dark:text-green-400"
                            : ""
                        }`}
                      >
                        {row.get(s)}
                        {best === ci && " ★"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
          Select at least two scenarios above to see the comparison table. (★ marks the
          best value per metric.)
        </p>
      )}
    </div>
  );
}
