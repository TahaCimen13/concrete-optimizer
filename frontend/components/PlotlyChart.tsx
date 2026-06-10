"use client";

// Build the React Plotly component against the lightweight dist bundle
// (plotly.js-dist-min) instead of the full `plotly.js/dist/plotly` that
// react-plotly.js imports by default. Loaded client-side only.
// @ts-expect-error - plotly.js-dist-min ships no type declarations
import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";

const Plot = createPlotlyComponent(Plotly);

export default Plot;
