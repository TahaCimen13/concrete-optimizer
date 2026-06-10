// Client-side helpers for talking to the FastAPI backend and the Next.js API.
// Calls go through the same-origin "/py" proxy (see next.config.ts → rewrites),
// so they work over localhost, the LAN IP or a deployed host with no CORS setup.

const API_BASE = "/py";

export interface Mix {
  "CO2 (kg/m3)": number;
  "Cost ($/m3)": number;
  "Strength (MPa)": number;
  "Cement (kg)": number;
  "Slag (kg)": number;
  "Water (L)": number;
  "Fly Ash (kg)": number;
  score?: number;
  is_pareto?: boolean;
}

export interface OptimizeStats {
  min_co2: number;
  min_cost: number;
  max_strength: number;
  avg_score: number;
  pareto_count: number;
}

export interface OptimizeResult {
  feasible_count: number;
  total_count: number;
  mixes: Mix[];
  pareto_indices: number[];
  best_mix: Mix | null;
  stats: OptimizeStats | null;
}

export interface Weights {
  wCo2: number;
  wCost: number;
  wStr: number;
  minStrength: number;
}

export interface Scenario {
  id: string;
  name: string;
  wCo2: number;
  wCost: number;
  wStr: number;
  minStrength: number;
  bestMix: Mix | null;
  createdAt: string;
}

// Identifies which dataset/model scope to optimize against (a logged-in user's
// uploaded data, or the default UCI baseline when absent).
export interface Scope {
  userId?: string | null;
}

export async function optimize(w: Weights, scope?: Scope): Promise<OptimizeResult> {
  const res = await fetch(`${API_BASE}/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      w_co2: w.wCo2,
      w_cost: w.wCost,
      w_str: w.wStr,
      min_strength: w.minStrength,
      user_id: scope?.userId ?? null,
    }),
  });
  if (!res.ok) throw new Error(`optimize failed: ${res.status}`);
  return res.json();
}

export async function downloadReport(
  name: string,
  w: Weights,
  bestMix: Mix | null,
  scope?: Scope,
): Promise<void> {
  const res = await fetch(`${API_BASE}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      w_co2: w.wCo2,
      w_cost: w.wCost,
      w_str: w.wStr,
      min_strength: w.minStrength,
      best_mix: bestMix,
      user_id: scope?.userId ?? null,
    }),
  });
  if (!res.ok) throw new Error(`report failed: ${res.status}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/\s+/g, "_") || "scenario"}_report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
