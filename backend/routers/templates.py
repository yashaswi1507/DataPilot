"""
Dashboard Templates — DataPilot
Looks at the dataset's column names (and detected types from
DatasetProfiler) and matches it against a small library of known
industry patterns (E-commerce, HR, Sales/CRM, Finance, Marketing,
Education, Healthcare-lite). Returns the best-matching template
with suggested KPIs and chart configs the frontend can render
directly without the user having to build charts manually.

This is keyword/pattern matching, not ML — intentionally simple
and explainable so users can see *why* a template was suggested.
"""
import sys
import re
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

sys.path.append("..")
from engines.dataset_profiler import DatasetProfiler
import pandas as pd

router = APIRouter()


class TemplatePayload(BaseModel):
    columns: List[str]
    data:    List[List[Any]]


# ── Template library ────────────────────────────────────────────
# Each template lists keyword patterns to look for in column names.
# A column "matches" a pattern if the pattern substring appears in
# the (lowercased, underscored) column name.
TEMPLATES = {
    "ecommerce": {
        "label": "E-commerce / Retail",
        "icon": "🛒",
        "keywords": ["order", "product", "sku", "price", "quantity", "qty", "revenue",
                     "discount", "cart", "customer", "shipping", "category"],
        "min_matches": 3,
        "suggested_kpis": ["Total Revenue", "Total Orders", "Avg Order Value", "Top Product"],
        "suggested_charts": [
            {"type": "line", "title": "Revenue Over Time",       "needs": ["date", "revenue_like"]},
            {"type": "bar",  "title": "Top Products by Revenue", "needs": ["category_like", "revenue_like"]},
            {"type": "pie",  "title": "Sales by Category",       "needs": ["category_like"]},
            {"type": "bar",  "title": "Orders by Region",        "needs": ["region_like"]},
        ],
    },
    "hr": {
        "label": "HR / People Analytics",
        "icon": "👥",
        "keywords": ["employee", "emp_id", "salary", "department", "hire", "attrition",
                     "performance", "manager", "designation", "experience", "tenure"],
        "min_matches": 3,
        "suggested_kpis": ["Total Employees", "Avg Salary", "Attrition Rate", "Avg Tenure"],
        "suggested_charts": [
            {"type": "bar",  "title": "Headcount by Department",  "needs": ["department_like"]},
            {"type": "pie",  "title": "Attrition Breakdown",       "needs": ["attrition_like"]},
            {"type": "histogram", "title": "Salary Distribution",  "needs": ["salary_like"]},
            {"type": "bar",  "title": "Avg Performance by Dept",   "needs": ["department_like", "performance_like"]},
        ],
    },
    "sales_crm": {
        "label": "Sales / CRM",
        "icon": "📈",
        "keywords": ["lead", "deal", "opportunity", "pipeline", "won", "lost", "stage",
                     "sales_rep", "salesperson", "quota", "close_date", "contract"],
        "min_matches": 2,
        "suggested_kpis": ["Total Deals", "Win Rate", "Avg Deal Size", "Pipeline Value"],
        "suggested_charts": [
            {"type": "bar",  "title": "Deals by Stage",       "needs": ["stage_like"]},
            {"type": "bar",  "title": "Revenue by Sales Rep", "needs": ["rep_like", "revenue_like"]},
            {"type": "pie",  "title": "Won vs Lost",          "needs": ["status_like"]},
            {"type": "line", "title": "Pipeline Over Time",   "needs": ["date"]},
        ],
    },
    "finance": {
        "label": "Finance / Accounting",
        "icon": "💰",
        "keywords": ["transaction", "amount", "balance", "expense", "income", "invoice",
                     "credit", "debit", "account", "payment", "budget", "tax"],
        "min_matches": 2,
        "suggested_kpis": ["Total Income", "Total Expense", "Net Balance", "Largest Transaction"],
        "suggested_charts": [
            {"type": "line", "title": "Balance Over Time",        "needs": ["date", "amount_like"]},
            {"type": "pie",  "title": "Expense by Category",      "needs": ["category_like"]},
            {"type": "bar",  "title": "Income vs Expense by Month","needs": ["date"]},
            {"type": "histogram", "title": "Transaction Amount Distribution", "needs": ["amount_like"]},
        ],
    },
    "marketing": {
        "label": "Marketing / Campaigns",
        "icon": "📣",
        "keywords": ["campaign", "impression", "click", "ctr", "conversion", "cpc", "cpm",
                     "spend", "channel", "engagement", "reach", "follower"],
        "min_matches": 2,
        "suggested_kpis": ["Total Spend", "Total Conversions", "Avg CTR", "Best Channel"],
        "suggested_charts": [
            {"type": "bar",  "title": "Spend by Channel",       "needs": ["channel_like"]},
            {"type": "line", "title": "Conversions Over Time",  "needs": ["date", "conversion_like"]},
            {"type": "pie",  "title": "Impressions by Campaign","needs": ["campaign_like"]},
            {"type": "scatter","title": "Spend vs Conversions", "needs": ["spend_like", "conversion_like"]},
        ],
    },
    "education": {
        "label": "Education / Academics",
        "icon": "🎓",
        "keywords": ["student", "score", "grade", "marks", "exam", "subject", "attendance",
                     "course", "gpa", "semester", "teacher"],
        "min_matches": 2,
        "suggested_kpis": ["Avg Score", "Pass Rate", "Total Students", "Top Subject"],
        "suggested_charts": [
            {"type": "histogram", "title": "Score Distribution",   "needs": ["score_like"]},
            {"type": "bar",  "title": "Avg Score by Subject",      "needs": ["subject_like", "score_like"]},
            {"type": "bar",  "title": "Attendance by Student",     "needs": ["attendance_like"]},
            {"type": "pie",  "title": "Grade Breakdown",           "needs": ["grade_like"]},
        ],
    },
}


def _normalize(col: str) -> str:
    return re.sub(r"[^a-z0-9]", "_", col.lower())


def _detect_template(columns: List[str]):
    normalized = [_normalize(c) for c in columns]
    joined = " ".join(normalized)

    scores = {}
    matched_keywords = {}
    for key, tpl in TEMPLATES.items():
        hits = [kw for kw in tpl["keywords"] if kw in joined]
        scores[key] = len(hits)
        matched_keywords[key] = hits

    best_key = max(scores, key=lambda k: scores[k]) if scores else None
    if not best_key or scores[best_key] < TEMPLATES[best_key]["min_matches"]:
        return None, [], {}

    return best_key, matched_keywords[best_key], scores


@router.post("/detect")
def detect_template(payload: TemplatePayload):
    """
    Given a dataset's columns (+ a data sample for type detection),
    suggest the best-matching industry template, or null if nothing
    matches confidently.
    """
    try:
        best_key, matched, all_scores = _detect_template(payload.columns)

        if not best_key:
            return {
                "success": True,
                "matched": False,
                "message": "No specific industry template matched strongly — using generic analysis.",
                "all_scores": all_scores,
            }

        tpl = TEMPLATES[best_key]
        return {
            "success": True,
            "matched": True,
            "template_key": best_key,
            "label": tpl["label"],
            "icon": tpl["icon"],
            "matched_keywords": matched,
            "confidence": min(100, round((len(matched) / max(len(tpl["keywords"]), 1)) * 100 * 2)),
            "suggested_kpis": tpl["suggested_kpis"],
            "suggested_charts": tpl["suggested_charts"],
            "all_scores": all_scores,
        }
    except Exception as e:
        raise HTTPException(500, f"Template detection failed: {e}")


@router.get("/list")
def list_templates():
    """Return the full template catalog (for a manual template picker)."""
    return {
        "success": True,
        "templates": [
            {"key": k, "label": v["label"], "icon": v["icon"], "suggested_kpis": v["suggested_kpis"]}
            for k, v in TEMPLATES.items()
        ],
    }
