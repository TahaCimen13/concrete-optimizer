"use client";

import type { Mix, Weights } from "@/lib/api";

interface Props {
  weights: Weights;
  bestMix: Mix | null;
}

function pickTrend(w: Weights) {
  const { wCo2, wCost, wStr } = w;
  const max = Math.max(wCo2, wCost, wStr);
  if (max === wCo2 && wCo2 > 50)
    return {
      cls: "from-green-100 to-green-200 border-green-300 dark:from-green-950 dark:to-green-900 dark:border-green-800",
      icon: "🌿",
      title: "Eco-Friendly Optimization",
      text: "Highlighting mixes with high supplementary cementitious materials (slag, fly ash) that cut clinker content and CO₂ emissions while keeping workability.",
    };
  if (max === wCost && wCost > 50)
    return {
      cls: "from-orange-100 to-orange-200 border-amber-300 dark:from-amber-950 dark:to-orange-950 dark:border-amber-800",
      icon: "💰",
      title: "Budget Optimization",
      text: "Focusing on cost-efficient designs. Replacing high-cost Portland cement with fly ash and slag is the primary lever for savings without major strength trade-offs.",
    };
  if (max === wStr && wStr > 50)
    return {
      cls: "from-violet-100 to-violet-200 border-violet-300 dark:from-violet-950 dark:to-purple-950 dark:border-violet-800",
      icon: "🏗️",
      title: "Structural Durability",
      text: "Prioritizing compressive strength. Lower water-to-cement ratios and higher cement content dominate this region — suited to heavily loaded structural elements.",
    };
  return {
    cls: "from-sky-100 to-blue-100 border-sky-300 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700",
    icon: "📊",
    title: "Balanced Multi-Objective Optimization",
    text: "All three objectives are weighted moderately. The Pareto front shows the non-dominated solutions — no single mix wins on every criterion at once.",
  };
}

export default function InsightsCard({ weights, bestMix }: Props) {
  const t = pickTrend(weights);
  return (
    <div
      className={`flex items-start gap-4 rounded-xl border bg-gradient-to-br p-5 shadow-sm ${t.cls}`}
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-white/70 text-xl dark:bg-black/30">
        {t.icon}
      </div>
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Dynamic System Insight
        </div>
        <div className="mb-1 text-base font-bold text-[var(--text)]">{t.title}</div>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">{t.text}</p>
        {bestMix && (
          <p className="mt-2 text-sm font-medium text-[var(--text)]">
            Recommended mix → CO₂ {bestMix["CO2 (kg/m3)"].toFixed(0)} kg/m³, $
            {bestMix["Cost ($/m3)"].toFixed(0)}/m³, {bestMix["Strength (MPa)"].toFixed(0)} MPa
            (cement {bestMix["Cement (kg)"].toFixed(0)} kg, fly ash{" "}
            {bestMix["Fly Ash (kg)"].toFixed(0)} kg).
          </p>
        )}
      </div>
    </div>
  );
}
