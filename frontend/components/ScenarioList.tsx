"use client";

import { useState } from "react";
import Link from "next/link";
import { downloadReport, type Scenario } from "@/lib/api";

interface Props {
  scenarios: Scenario[];
  onDelete: (id: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export default function ScenarioList({
  scenarios,
  onDelete,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: Props) {
  // Inline two-step delete confirmation (avoids native confirm(), which is
  // unsupported in some embedded browsers).
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  if (scenarios.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          No saved scenarios yet.{" "}
          <Link href="/optimizer" className="font-semibold text-[var(--primary-light)]">
            Open the optimizer
          </Link>{" "}
          and hit “Save Scenario”.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {scenarios.map((s) => {
        const selected = selectedIds?.has(s.id);
        return (
          <div
            key={s.id}
            className={`flex flex-col gap-3 rounded-xl border bg-[var(--surface)] p-4 shadow-sm transition ${
              selected
                ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                : "border-[var(--border)]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-[var(--primary)]">{s.name}</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              {selectable && (
                <input
                  type="checkbox"
                  checked={!!selected}
                  onChange={() => onToggleSelect?.(s.id)}
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge>🌿 CO₂ {s.wCo2}</Badge>
              <Badge>💰 Cost {s.wCost}</Badge>
              <Badge>🏗️ Str {s.wStr}</Badge>
              <Badge>≥ {s.minStrength} MPa</Badge>
            </div>

            {s.bestMix && (
              <p className="text-xs text-[var(--text-muted)]">
                Best: CO₂ {s.bestMix["CO2 (kg/m3)"].toFixed(0)} · $
                {s.bestMix["Cost ($/m3)"].toFixed(0)} ·{" "}
                {s.bestMix["Strength (MPa)"].toFixed(0)} MPa
              </p>
            )}

            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              <Link
                href={`/optimizer?wCo2=${s.wCo2}&wCost=${s.wCost}&wStr=${s.wStr}&minStrength=${s.minStrength}`}
                className="rounded-md bg-[var(--primary-pale)] px-2.5 py-1.5 text-xs font-semibold text-[var(--primary-light)] hover:brightness-95"
              >
                Load
              </Link>
              <button
                onClick={() =>
                  downloadReport(
                    s.name,
                    {
                      wCo2: s.wCo2,
                      wCost: s.wCost,
                      wStr: s.wStr,
                      minStrength: s.minStrength,
                    },
                    s.bestMix,
                  )
                }
                className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
              >
                📄 PDF
              </button>
              {confirmingId === s.id ? (
                <>
                  <button
                    onClick={() => {
                      onDelete(s.id);
                      setConfirmingId(null);
                    }}
                    className="rounded-md bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingId(s.id)}
                  className="rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-medium text-[var(--text-muted)]">
      {children}
    </span>
  );
}
