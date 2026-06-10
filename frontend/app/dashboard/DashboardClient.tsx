"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ScenarioList from "@/components/ScenarioList";
import type { Scenario } from "@/lib/api";

export default function DashboardClient() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scenarios");
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
    if (res.ok) setScenarios((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Saved Scenarios" value={String(scenarios.length)} />
        <Stat
          label="Avg. CO₂ Weight"
          value={
            scenarios.length
              ? (
                  scenarios.reduce((a, s) => a + s.wCo2, 0) / scenarios.length
                ).toFixed(0)
              : "—"
          }
        />
        <Link
          href="/compare"
          className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--primary-pale)] p-4 text-sm font-semibold text-[var(--primary-light)] transition hover:brightness-95"
        >
          Compare scenarios →
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
        <ScenarioList scenarios={scenarios} onDelete={handleDelete} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div className="text-2xl font-extrabold text-[var(--primary)]">{value}</div>
    </div>
  );
}
