"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import Navbar from "@/components/Navbar";
import WeightSliders from "@/components/WeightSliders";
import StatsStrip from "@/components/StatsStrip";
import InsightsCard from "@/components/InsightsCard";
import ParetoPlot from "@/components/ParetoPlot";
import {
  downloadReport,
  optimize,
  type OptimizeResult,
  type Weights,
} from "@/lib/api";

const DEFAULT_WEIGHTS: Weights = {
  wCo2: 50,
  wCost: 30,
  wStr: 20,
  minStrength: 25,
};

export default function OptimizerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-muted)]">
          Loading optimizer…
        </div>
      }
    >
      <OptimizerInner />
    </Suspense>
  );
}

function OptimizerInner() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const router = useRouter();
  const params = useSearchParams();

  // Allow loading a saved scenario via query params (?wCo2=&wCost=&wStr=&minStrength=&name=)
  const initial: Weights = {
    wCo2: Number(params.get("wCo2")) || DEFAULT_WEIGHTS.wCo2,
    wCost: Number(params.get("wCost")) || DEFAULT_WEIGHTS.wCost,
    wStr: Number(params.get("wStr")) || DEFAULT_WEIGHTS.wStr,
    minStrength: Number(params.get("minStrength")) || DEFAULT_WEIGHTS.minStrength,
  };

  const [weights, setWeights] = useState<Weights>(initial);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [scenarioName, setScenarioName] = useState("My Scenario");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runOptimize = useCallback(
    async (w: Weights) => {
      setLoading(true);
      setError(null);
      try {
        const res = await optimize(w, { userId });
        setResult(res);
      } catch {
        setError(
          "Could not reach the optimization backend. Is the FastAPI server running on :8000?",
        );
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  // Debounced re-optimize whenever weights or the active dataset (user) change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runOptimize(weights), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [weights, runOptimize]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = () => {
    if (status !== "authenticated") {
      router.push("/login?callbackUrl=/optimizer");
      return;
    }
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    const name = scenarioName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...weights, name, bestMix: result?.best_mix ?? null }),
      });
      if (!res.ok) throw new Error();
      setShowSaveModal(false);
      showToast("✓ Scenario saved to your comparison list.");
    } catch {
      showToast("✗ Failed to save scenario.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      await downloadReport("ConcreteDSS Scenario", weights, result?.best_mix ?? null, {
        userId,
      });
    } catch {
      showToast("✗ Failed to generate PDF (backend offline?).");
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col gap-5 border-b border-[var(--border)] bg-[var(--surface)] p-5 lg:border-b-0 lg:border-r">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--primary-light)]">
            Selection &amp; Design Criteria
          </div>
          <WeightSliders weights={weights} onChange={setWeights} />

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Actions
            </h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-gradient-to-br from-[var(--primary-light)] to-[#1d4e89] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Saving…" : "💾 Save Scenario"}
              </button>
              <button
                onClick={handleExport}
                className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-pale)]"
              >
                📄 Export PDF Report
              </button>
            </div>
          </div>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-muted)]">
            <span>⚠️</span>
            Decision support tool — validate with lab testing before use.
          </p>
        </aside>

        {/* Main */}
        <main className="flex flex-col gap-5 overflow-y-auto p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[var(--primary)]">
                Pareto Front for Selected Criteria
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                3D trade-off surface: CO₂ · Cost · Strength. Rotate, zoom and hover any
                point for its mix proportions.
              </p>
            </div>
            <span className="rounded-full border border-sky-300 bg-[var(--primary-pale)] px-3 py-1 text-xs font-semibold text-[var(--primary-light)]">
              {result ? `${result.total_count} Candidates` : "Loading…"}
            </span>
          </header>

          <StatsStrip result={result} />

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                3D Pareto Front Visualization
              </span>
              {loading && (
                <span className="text-xs text-[var(--text-muted)]">updating…</span>
              )}
            </div>
            {error ? (
              <div className="flex h-[560px] items-center justify-center rounded-lg bg-[var(--surface-2)] px-6 text-center text-sm text-red-500">
                {error}
              </div>
            ) : result && result.feasible_count === 0 ? (
              <div className="flex h-[560px] items-center justify-center rounded-lg bg-[var(--surface-2)] px-6 text-center text-sm text-[var(--text-muted)]">
                No mixes satisfy a minimum strength of {weights.minStrength} MPa. Lower
                the constraint to see feasible designs.
              </div>
            ) : result ? (
              <ParetoPlot
                mixes={result.mixes}
                paretoIndices={result.pareto_indices}
                bestMix={result.best_mix}
              />
            ) : (
              <div className="flex h-[560px] items-center justify-center text-sm text-[var(--text-muted)]">
                Loading mixes…
              </div>
            )}
          </div>

          <InsightsCard weights={weights} bestMix={result?.best_mix ?? null} />
        </main>
      </div>

      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-bold text-[var(--primary)]">Save Scenario</h3>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              Give this scenario a name to store it in your comparison list.
            </p>
            <input
              autoFocus
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSave();
                if (e.key === "Escape") setShowSaveModal(false);
              }}
              placeholder="Scenario name"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                disabled={saving || !scenarioName.trim()}
                className="rounded-md bg-gradient-to-br from-[var(--primary-light)] to-[#1d4e89] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
