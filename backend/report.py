"""Scenario PDF report generation (reportlab).

Builds a one-page performance report for a saved/active scenario: the objective
weights, the active strength constraint, and the recommended (best) mix design.
Reuses the same visual style as data_module.create_math_pdf.
"""
from __future__ import annotations

import io

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def build_scenario_report(scenario: dict, model_metrics: dict | None = None) -> bytes:
    """Return PDF bytes for a scenario.

    scenario keys (all optional, sensible fallbacks applied):
      name, w_co2, w_cost, w_str, min_strength, best_mix (dict of mix props)
    model_metrics: optional ML model metrics (r2, rmse, ...) for the methodology section.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "T", parent=styles["Title"], fontSize=20,
        textColor=colors.HexColor("#1a3a5c"), spaceAfter=6, alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        "S", parent=styles["Normal"], fontSize=11,
        textColor=colors.HexColor("#4a6fa5"), alignment=TA_CENTER, spaceAfter=14,
    )
    heading_style = ParagraphStyle(
        "H", parent=styles["Heading2"], fontSize=13,
        textColor=colors.HexColor("#2e6da4"), spaceBefore=18, spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "B", parent=styles["Normal"], fontSize=10, leading=16,
        alignment=TA_JUSTIFY, spaceAfter=6,
    )
    disclaimer_style = ParagraphStyle(
        "D", parent=styles["Normal"], fontSize=8.5,
        textColor=colors.HexColor("#7a5c00"), alignment=TA_JUSTIFY,
        backColor=colors.HexColor("#fff8e1"), borderPadding=(8, 10, 8, 10),
    )

    name = scenario.get("name") or "Untitled Scenario"
    w_co2 = float(scenario.get("w_co2", 0))
    w_cost = float(scenario.get("w_cost", 0))
    w_str = float(scenario.get("w_str", 0))
    min_strength = scenario.get("min_strength", "—")
    best = scenario.get("best_mix") or {}

    def table(rows, col_widths):
        t = Table(rows, colWidths=col_widths)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2e6da4")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.HexColor("#eef4fb"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#b0c4de")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ]))
        return t

    story = []
    story.append(Paragraph("Scenario Performance Report", title_style))
    story.append(Paragraph(name, subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2,
                            color=colors.HexColor("#2e6da4"), spaceAfter=16))

    story.append(Paragraph("1. Objective Weights", heading_style))
    story.append(Paragraph(
        "The composite objective uses the Weighted Sum Method "
        "(F = w1·f_CO2 + w2·f_Cost − w3·f_Strength). Weights below reflect "
        "the engineering priorities selected for this scenario.",
        body_style,
    ))
    story.append(Spacer(1, 6))
    story.append(table(
        [["Objective", "Weight", "Direction"],
         ["CO2 Emissions", f"{w_co2:g}", "Minimize"],
         ["Material Cost", f"{w_cost:g}", "Minimize"],
         ["Compressive Strength", f"{w_str:g}", "Maximize"]],
        [7 * cm, 4 * cm, 4 * cm],
    ))

    story.append(Paragraph("2. Engineering Constraint", heading_style))
    story.append(Paragraph(
        f"Minimum compressive strength: <b>{min_strength} MPa</b>. "
        "Mixes below this threshold were excluded from the candidate set.",
        body_style,
    ))

    story.append(Paragraph("3. Recommended Mix Design", heading_style))
    if best:
        def g(k):
            v = best.get(k)
            return f"{v:g}" if isinstance(v, (int, float)) else (v if v is not None else "—")

        story.append(Paragraph(
            "The mix below minimizes the composite objective for the selected weights:",
            body_style,
        ))
        story.append(Spacer(1, 6))
        story.append(table(
            [["Property", "Value"],
             ["CO2 Emissions", f"{g('CO2 (kg/m3)')} kg/m3"],
             ["Material Cost", f"${g('Cost ($/m3)')}/m3"],
             ["Compressive Strength (predicted)", f"{g('Strength (MPa)')} MPa"],
             ["Cement", f"{g('Cement (kg)')} kg"],
             ["Slag (GGBS)", f"{g('Slag (kg)')} kg"],
             ["Fly Ash", f"{g('Fly Ash (kg)')} kg"],
             ["Water", f"{g('Water (L)')} L"],
             ["Superplasticizer", f"{g('Superplasticizer (kg)')} kg"],
             ["Coarse Aggregate", f"{g('Coarse Agg (kg)')} kg"],
             ["Fine Aggregate", f"{g('Fine Agg (kg)')} kg"],
             ["Age", f"{g('Age (day)')} days"]],
            [7 * cm, 8 * cm],
        ))
    else:
        story.append(Paragraph(
            "No feasible mix was recorded for this scenario "
            "(constraint may be too strict).", body_style,
        ))

    story.append(Paragraph("4. Methodology", heading_style))
    if model_metrics:
        story.append(Paragraph(
            "Compressive strength is predicted by a {m} trained on the UCI Concrete "
            "Compressive Strength dataset ({n} samples), achieving R² = {r2} and "
            "RMSE = {rmse} MPa on a hold-out test set. The Pareto-optimal mix designs "
            "are generated by the NSGA-II multi-objective genetic algorithm, minimizing "
            "CO2 and cost while maximizing predicted strength, subject to water/cement, "
            "binder-content and density constraints. CO2 and cost use literature-based "
            "emission factors and unit prices.".format(
                m=model_metrics.get("model", "ML model"),
                n=model_metrics.get("n_samples", "—"),
                r2=model_metrics.get("r2", "—"),
                rmse=model_metrics.get("rmse", "—"),
            ),
            body_style,
        ))
    story.append(Paragraph(
        "Dataset: Yeh, I-C. (1998). Modeling of strength of high-performance concrete "
        "using artificial neural networks. Cement and Concrete Research, 28(12), "
        "1797-1808. UCI Machine Learning Repository.",
        body_style,
    ))

    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1,
                            color=colors.HexColor("#cccccc"), spaceAfter=10))
    story.append(Paragraph(
        "DISCLAIMER — Decision Support Tool Only: Strength values are model "
        "predictions and CO2/cost figures use indicative literature factors. All "
        "results must be validated through physical laboratory testing and independent "
        "expert engineering review before application in any construction context.",
        disclaimer_style,
    ))

    doc.build(story)
    return buf.getvalue()
