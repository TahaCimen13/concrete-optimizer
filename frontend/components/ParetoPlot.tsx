"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Mix } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";

// Plotly references `window`/`document`; load it client-side only.
const Plot = dynamic(() => import("@/components/PlotlyChart"), { ssr: false });

interface Props {
  mixes: Mix[];
  paretoIndices: number[];
  bestMix: Mix | null;
}

export default function ParetoPlot({ mixes, paretoIndices, bestMix }: Props) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const data = useMemo(() => {
    const paretoSet = new Set(paretoIndices);
    const dominated = mixes.filter((_, i) => !paretoSet.has(i));
    const pareto = mixes.filter((_, i) => paretoSet.has(i));

    const hover =
      "<b>Mix Design</b><br>" +
      "Strength: %{z:.1f} MPa<br>" +
      "CO₂: %{x:.1f} kg/m³<br>" +
      "Cost: $%{y:.2f}/m³<br>" +
      "──────────────<br>" +
      "Cement: %{customdata[0]:.0f} kg<br>" +
      "Slag: %{customdata[1]:.0f} kg<br>" +
      "Fly Ash: %{customdata[2]:.0f} kg<br>" +
      "Water: %{customdata[3]:.0f} L<extra></extra>";

    const cd = (arr: Mix[]) =>
      arr.map((m) => [
        m["Cement (kg)"],
        m["Slag (kg)"],
        m["Fly Ash (kg)"],
        m["Water (L)"],
      ]);

    const traces: Record<string, unknown>[] = [
      {
        type: "scatter3d",
        mode: "markers",
        name: "Dominated",
        x: dominated.map((m) => m["CO2 (kg/m3)"]),
        y: dominated.map((m) => m["Cost ($/m3)"]),
        z: dominated.map((m) => m["Strength (MPa)"]),
        customdata: cd(dominated),
        hovertemplate: hover,
        marker: {
          size: 4,
          color: dark ? "#475569" : "#9fb4ce",
          opacity: 0.5,
        },
      },
      {
        type: "scatter3d",
        mode: "markers",
        name: "Pareto-optimal",
        x: pareto.map((m) => m["CO2 (kg/m3)"]),
        y: pareto.map((m) => m["Cost ($/m3)"]),
        z: pareto.map((m) => m["Strength (MPa)"]),
        customdata: cd(pareto),
        hovertemplate: hover,
        marker: {
          size: 6,
          color: pareto.map((m) => m["Strength (MPa)"]),
          colorscale: "Viridis",
          opacity: 0.9,
          line: { width: 0.5, color: "rgba(0,0,0,0.3)" },
          colorbar: {
            title: { text: "Strength<br>(MPa)", side: "right" },
            thickness: 14,
            len: 0.7,
          },
        },
      },
    ];

    if (bestMix) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        name: "Recommended",
        x: [bestMix["CO2 (kg/m3)"]],
        y: [bestMix["Cost ($/m3)"]],
        z: [bestMix["Strength (MPa)"]],
        customdata: cd([bestMix]),
        hovertemplate: hover,
        marker: {
          size: 11,
          color: "#dc2626",
          symbol: "diamond",
          line: { width: 1.5, color: "#fff" },
        },
      });
    }

    return traces;
  }, [mixes, paretoIndices, bestMix, dark]);

  const axisColor = dark ? "#94a3b8" : "#1a3a5c";
  const gridColor = dark ? "rgba(120,140,170,0.25)" : "rgba(130,150,180,0.35)";
  const sceneBg = dark ? "rgba(15,24,39,1)" : "rgba(236,242,250,1)";

  const layout = {
    autosize: true,
    height: 560,
    paper_bgcolor: "rgba(0,0,0,0)",
    font: { color: axisColor, size: 11 },
    legend: { orientation: "h", y: 1.02, x: 0.5, xanchor: "center" },
    margin: { l: 0, r: 0, t: 30, b: 0 },
    scene: {
      bgcolor: sceneBg,
      xaxis: {
        title: { text: "CO₂ (kg/m³)" },
        gridcolor: gridColor,
        color: axisColor,
      },
      yaxis: {
        title: { text: "Cost ($/m³)" },
        gridcolor: gridColor,
        color: axisColor,
      },
      zaxis: {
        title: { text: "Strength (MPa)" },
        gridcolor: gridColor,
        color: axisColor,
      },
      camera: { eye: { x: 1.6, y: 1.6, z: 0.9 } },
    },
  };

  return (
    <Plot
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data={data as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      layout={layout as any}
      config={{ responsive: true, displaylogo: false }}
      style={{ width: "100%", height: "560px" }}
      useResizeHandler
    />
  );
}
