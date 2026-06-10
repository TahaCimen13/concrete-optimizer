"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

interface DatasetInfo {
  n_samples: number;
  source: string;
  model: { r2: number; rmse: number; cv_r2_mean: number };
}

interface ValidationReport {
  matched_columns: Record<string, string>;
  rows_in: number;
  rows_out: number;
  dropped_nulls: number;
  dropped_negatives: number;
  warnings: string[];
}

export default function DataClient() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [info, setInfo] = useState<DatasetInfo | null>(null);
  const [mode, setMode] = useState<"combine" | "replace">("combine");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadInfo = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/py/dataset?user_id=${userId}`);
    if (res.ok) setInfo(await res.json());
  }, [userId]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const handleUpload = async () => {
    if (!file || !userId) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("user_id", userId);
      fd.append("mode", mode);
      const res = await fetch("/py/dataset/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Upload failed.");
        return;
      }
      setReport(data.validation_report);
      flash(`✓ Model retrained — R² ${data.model.r2}`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await loadInfo();
    } catch {
      setError("Upload failed. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await fetch("/py/dataset/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      setReport(null);
      flash("↺ Reverted to the UCI reference dataset.");
      await loadInfo();
    } finally {
      setBusy(false);
    }
  };

  const usingUpload = info?.source && !info.source.startsWith("UCI default");

  return (
    <div className="flex flex-col gap-5">
      {/* Active dataset */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Active dataset
        </div>
        {info ? (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <Field label="Source" value={info.source} />
            <Field label="Samples" value={String(info.n_samples)} />
            <Field label="Model R²" value={info.model.r2.toFixed(3)} />
            <Field label="RMSE" value={`${info.model.rmse} MPa`} />
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        )}
        {usingUpload && (
          <button
            onClick={handleReset}
            disabled={busy}
            className="mt-4 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            ↺ Reset to UCI reference
          </button>
        )}
      </div>

      {/* Upload */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Upload dataset
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-[var(--text)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--primary-pale)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--primary-light)] hover:file:brightness-95"
        />

        <div className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text)]">How to use it</span>
          <label className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="radio"
              name="mode"
              checked={mode === "combine"}
              onChange={() => setMode("combine")}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              <b className="text-[var(--text)]">Combine with UCI</b> — merge your data with
              the reference dataset (recommended; keeps the model general).
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="radio"
              name="mode"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              <b className="text-[var(--text)]">Replace</b> — train only on your data
              (bigger shift; use for a self-contained dataset).
            </span>
          </label>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || busy}
          className="mt-5 rounded-md bg-gradient-to-br from-[var(--primary-light)] to-[#1d4e89] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Processing…" : "Upload & retrain"}
        </button>

        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Required columns: cement, slag, fly ash, water, superplasticizer, coarse/fine
          aggregate, compressive strength (age optional). Column names are auto-matched.
        </p>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Validation report */}
      {report && (
        <div className="rounded-xl border border-green-300 bg-green-50 p-5 shadow-sm dark:border-green-800 dark:bg-green-950/30">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
            Processed ✓
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            <Field label="Rows read" value={String(report.rows_in)} />
            <Field label="Valid rows" value={String(report.rows_out)} />
            <Field label="Dropped (invalid)" value={String(report.dropped_nulls + report.dropped_negatives)} />
          </div>
          <div className="mt-3 text-sm text-[var(--text-muted)]">
            <b className="text-[var(--text)]">Matched columns:</b>{" "}
            {Object.entries(report.matched_columns)
              .map(([k, v]) => `${v} → ${k}`)
              .join(", ")}
          </div>
          {report.warnings.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm text-amber-700 dark:text-amber-400">
              {report.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <Link
            href="/optimizer"
            className="mt-4 inline-block rounded-md bg-[var(--primary-light)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            See it in the optimizer →
          </Link>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div className="text-sm font-bold text-[var(--text)]">{value}</div>
    </div>
  );
}
