"use client";

import type { Weights } from "@/lib/api";

interface Props {
  weights: Weights;
  onChange: (w: Weights) => void;
}

const SLIDERS: { key: keyof Weights; icon: string; label: string }[] = [
  { key: "wCo2", icon: "🌿", label: "CO₂ Weight" },
  { key: "wCost", icon: "💰", label: "Cost Weight" },
  { key: "wStr", icon: "🏗️", label: "Strength Weight" },
];

const WEIGHT_KEYS: (keyof Weights)[] = ["wCo2", "wCost", "wStr"];

export default function WeightSliders({ weights, onChange }: Props) {
  // Auto-balancing: when one objective weight changes, the other two absorb the
  // difference proportionally so the three always sum to exactly 100.
  const setWeight = (key: keyof Weights, value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value || 0)));
    const others = WEIGHT_KEYS.filter((k) => k !== key);
    const remaining = 100 - v;
    const o1 = weights[others[0]];
    const o2 = weights[others[1]];
    const s = o1 + o2;

    let n1: number;
    if (s === 0) {
      n1 = Math.round(remaining / 2); // both others were 0 → split evenly
    } else {
      n1 = Math.round((o1 / s) * remaining); // keep the others' relative ratio
    }
    const n2 = remaining - n1; // exact: guarantees the total is 100

    onChange({ ...weights, [key]: v, [others[0]]: n1, [others[1]]: n2 });
  };

  const setMinStrength = (value: number) => {
    const v = Math.max(0, Math.min(80, Math.round(value || 0)));
    onChange({ ...weights, minStrength: v });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          Objective Weights
        </h3>

        {SLIDERS.map(({ key, icon, label }) => (
          <div key={key} className="mb-4 last:mb-0">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text)]">
                {icon} {label}
              </span>
              <span className="min-w-[38px] rounded-full bg-[var(--primary-pale)] px-2 py-0.5 text-center text-xs font-bold text-[var(--primary-light)]">
                {weights[key]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={weights[key]}
                onChange={(e) => setWeight(key, Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={weights[key]}
                onChange={(e) => setWeight(key, Number(e.target.value))}
                className="w-14 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1 text-center text-sm font-semibold text-[var(--primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        ))}

        <div className="mt-2 flex items-center gap-2 rounded-md bg-[var(--primary-pale)] px-3 py-2 text-sm">
          <span className="text-[var(--text-muted)]">Total</span>
          <span className="font-bold text-[var(--primary-light)]">100</span>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Structural Constraint
        </h3>
        <label className="mb-1.5 block text-sm font-semibold text-[var(--text)]">
          Minimum Strength{" "}
          <span className="font-normal text-[var(--text-muted)]">(MPa)</span>
        </label>
        <input
          type="number"
          min={0}
          max={80}
          value={weights.minStrength}
          onChange={(e) => setMinStrength(Number(e.target.value))}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
      </div>
    </div>
  );
}
