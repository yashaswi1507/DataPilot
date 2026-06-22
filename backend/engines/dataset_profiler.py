import pandas as pd
import numpy as np
import re


class DatasetProfiler:

    def __init__(self, df):
        self.df = df.copy()
        self.profile_report = {}

    # =====================================================
    # PUBLIC API
    # =====================================================

    def profile_columns(self):
        return self.profile_dataset()

    def profile_dataset(self):
        for col in self.df.columns:
            self.profile_report[col] = self.profile_column(col)
        return self.profile_report

    # =====================================================
    # DATASET-LEVEL LABEL  (display only, never used for cleaning)
    # =====================================================

    def detect_dataset_type(self):
        if not self.profile_report:
            self.profile_dataset()

        counts = {}
        for p in self.profile_report.values():
            t = p.get("detected_type", "text")
            counts[t] = counts.get(t, 0) + 1

        total = sum(counts.values()) or 1
        def pct(t): return counts.get(t, 0) / total

        if pct("structured_code") >= 0.2:   return "transactional"
        if pct("date") >= 0.15 and pct("numeric") >= 0.2: return "time-series"
        if pct("numeric") >= 0.5:           return "numeric-heavy"
        if pct("name") >= 0.2 and pct("category") >= 0.15: return "people-records"
        if pct("category") >= 0.4:          return "categorical"
        return "mixed"

    # =====================================================
    # RECOMMENDATIONS — target column, task type, model,
    # forecasting column. All derived from actual profiled
    # data, never hardcoded.
    # =====================================================

    def get_recommendations(self):
        if not self.profile_report:
            self.profile_dataset()

        numeric_cols  = [c for c,p in self.profile_report.items() if p["detected_type"] == "numeric"]
        category_cols = [c for c,p in self.profile_report.items() if p["detected_type"] == "category"]
        date_cols     = [c for c,p in self.profile_report.items() if p["detected_type"] == "date"]

        # ── Recommended target: numeric column with highest variance
        # relative to its mean (signals a meaningful outcome metric,
        # not an ID-like column), excluding near-constant columns.
        target_col  = None
        task_type   = None
        best_model  = None

        if numeric_cols:
            variances = {}
            for c in numeric_cols:
                series = self.df[c].dropna()
                if len(series) < 2:
                    continue
                mean = series.mean()
                std  = series.std()
                if mean == 0 or pd.isna(std):
                    continue
                cv = std / abs(mean)  # coefficient of variation
                uniq_ratio = series.nunique() / max(len(series), 1)
                # Penalize columns that look like IDs (near-100% unique, large integers)
                if uniq_ratio > 0.95 and series.nunique() > 20:
                    continue
                variances[c] = cv
            if variances:
                target_col = max(variances, key=variances.get)

        if not target_col and numeric_cols:
            target_col = numeric_cols[0]

        # ── Task type: regression if target is continuous numeric,
        # classification if target is categorical with few classes.
        if target_col:
            uniq = self.df[target_col].nunique()
            if uniq <= 10 and target_col in category_cols:
                task_type  = "Classification"
                best_model = "Random Forest Classifier"
            else:
                task_type  = "Regression"
                best_model = "Random Forest"
        elif category_cols:
            target_col = category_cols[0]
            task_type  = "Classification"
            best_model = "Random Forest Classifier"

        # ── Forecasting column: a date column if one exists
        forecast_col = date_cols[0] if date_cols else None

        # ── Data quality score: based on missing values + duplicates ratio
        # Previous formula used 0.6/0.4 multipliers which made the score
        # barely move even with real issues (e.g. 1.9% missing + 0.1% dupes
        # only dropped the score by ~1 point, landing at 99/100 — misleading).
        # New formula scales missing/duplicate ratios up before subtracting,
        # plus checks per-column missing rates so one badly-missing column
        # doesn't get diluted away by many clean columns.
        total_cells   = self.df.shape[0] * max(self.df.shape[1], 1)
        missing_cells = sum(p["missing_count"] for p in self.profile_report.values())
        missing_ratio = missing_cells / total_cells if total_cells else 0
        dup_ratio     = self.df.duplicated().sum() / max(len(self.df), 1)

        # Worst single-column missing rate also factors in — a dataset where
        # one important column is 40% empty shouldn't score "Excellent" just
        # because the other 17 columns are complete.
        col_missing_rates = [p["missing_percent"] / 100 for p in self.profile_report.values()]
        worst_col_missing = max(col_missing_rates) if col_missing_rates else 0

        penalty = (missing_ratio * 100 * 2.5) + (dup_ratio * 100 * 2.0) + (worst_col_missing * 100 * 0.5)
        quality_score = round(max(0, min(100, 100 - penalty)))

        quality_label = "Excellent" if quality_score >= 90 else "Good" if quality_score >= 75 else "Fair" if quality_score >= 50 else "Poor"

        return {
            "recommended_target":   target_col,
            "recommended_task":     task_type or "Regression",
            "recommended_model":    best_model or "Random Forest",
            "forecasting_column":   forecast_col,
            "dataset_type":         self.detect_dataset_type(),
            "data_quality_score":   quality_score,
            "data_quality_label":   quality_label,
            "numeric_columns":      numeric_cols,
            "categorical_columns":  category_cols,
            "date_columns":         date_cols,
        }

    # =====================================================
    # PROFILE ONE COLUMN
    # =====================================================

    def profile_column(self, col):
        series = self.df[col]
        n = max(len(series), 1)

        profile = {
            "dtype":            str(series.dtype),
            "missing_count":    int(series.isnull().sum()),
            "missing_percent":  round(series.isnull().sum() / n * 100, 2),
            "unique_count":     int(series.nunique()),
            "unique_percent":   round(series.nunique() / n * 100, 2),
        }

        sample_values = (
            series.dropna()
            .astype(str)
            .head(50)
            .tolist()
        )
        profile["sample_values"] = sample_values[:10]

        detected_type = self._detect_type(series, sample_values, n)
        profile["detected_type"]     = detected_type
        profile["cleaning_strategy"] = self._cleaning_strategy(detected_type)

        return profile

    # =====================================================
    # COLUMN TYPE DETECTION — purely data-driven
    # NO column names are read anywhere in this function.
    # Rules go from most-specific → most-general.
    # =====================================================

    def _detect_type(self, series, sample, n):

        n_sample = max(len(sample), 1)
        unique_ratio = series.nunique() / n

        # ── RULE 1: Already numeric dtype ───────────────
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"

        # ── RULE 2: Numeric string (handles "1,200" "₹500" "3.14%") ──
        cleaned_num = (
            series.dropna()
            .astype(str)
            .str.replace(r"[,\$€£₹%\s]", "", regex=True)
        )
        num_ratio = pd.to_numeric(cleaned_num, errors="coerce").notna().mean() if len(cleaned_num) else 0
        if num_ratio >= 0.85:
            return "numeric"

        # ── RULE 3: Date / datetime ──────────────────────
        # Check BEFORE phone because "2024-01-01" passes phone regex too.
        # We use a strict format list so random strings don't false-positive.
        DATE_FORMATS = [
            "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%Y",
            "%Y/%m/%d", "%d.%m.%Y", "%Y.%m.%d",
            "%d-%b-%Y", "%d %b %Y", "%B %d, %Y",
            "%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S",
        ]
        date_hits = 0
        for v in sample:
            parsed = False
            for fmt in DATE_FORMATS:
                try:
                    pd.to_datetime(v, format=fmt)
                    parsed = True
                    break
                except Exception:
                    pass
            if parsed:
                date_hits += 1
        if date_hits / n_sample >= 0.75:
            return "date"

        # ── RULE 4: Structured code ─────────────────────
        # Pattern: letters/digits on both sides of a separator (-, _, /, |, \)
        # e.g. ORD-001  EMP_042  INV/99  A-123  PRD-B2
        sep_re = re.compile(r"^[A-Za-z0-9]+[-_/|\\][A-Za-z0-9]+$")
        struct_hits = sum(1 for v in sample if sep_re.match(v.strip()))
        if struct_hits / n_sample >= 0.60:
            return "structured_code"

        # ── RULE 5: Email ────────────────────────────────
        email_re = re.compile(r"^[\w.\-+]+@[\w\-]+\.[a-zA-Z]{2,}$")
        if sum(1 for v in sample if email_re.match(v.strip())) / n_sample >= 0.50:
            return "email"

        # ── RULE 6: Phone ────────────────────────────────
        # Must NOT look like a date (dates have been caught already).
        # Phone: mostly digits, optional +, spaces, parens, hyphens. 7–15 chars.
        phone_re = re.compile(r"^\+?[\d\s\-\(\)]{7,15}$")
        phone_hits = sum(1 for v in sample if phone_re.match(v.strip()))
        if phone_hits / n_sample >= 0.60:
            return "phone"

        # ── RULE 7: Address ──────────────────────────────
        # Addresses are long, contain digits mixed with words, and often
        # have commas, slashes, or are clearly multi-part.
        avg_len = np.mean([len(v) for v in sample]) if sample else 0
        digit_and_word_re = re.compile(r"\d")
        addr_hits = sum(
            1 for v in sample
            if digit_and_word_re.search(v)
            and ("," in v or "/" in v or len(v) > 25)
        )
        if addr_hits / n_sample >= 0.55 and avg_len > 20:
            return "address"

        # ── RULE 8: Human name ───────────────────────────
        # Key insight: a column with human names has HIGH diversity
        # RELATIVE TO ITS OWN values — each person appears roughly once.
        # We measure uniqueness of the non-null values themselves,
        # not against total rows (which could be repeated).
        non_null_vals  = series.dropna().astype(str).tolist()
        n_nonnull      = max(len(non_null_vals), 1)
        internal_uniq  = len(set(non_null_vals)) / n_nonnull  # uniqueness within non-null values

        name_re = re.compile(r"^[A-Za-z][A-Za-z .'\-]{1,39}$")
        name_hits = sum(1 for v in sample if name_re.match(v.strip()))

        if (
            name_hits / n_sample >= 0.70      # mostly alpha strings
            and internal_uniq >= 0.30          # at least 30% of values are distinct
            and avg_len <= 40
            and avg_len >= 3
        ):
            return "name"

        # ── RULE 9: Category / label ─────────────────────
        # Adaptive threshold: a column is categorical if its cardinality
        # is low relative to the number of rows.
        # Threshold relaxes for larger datasets.
        if n < 50:    cat_thresh = 0.60
        elif n < 200: cat_thresh = 0.40
        elif n < 1000: cat_thresh = 0.25
        else:          cat_thresh = 0.15

        if unique_ratio <= cat_thresh:
            return "category"

        # ── RULE 10: Free text ───────────────────────────
        return "text"

    # =====================================================
    # CLEANING STRATEGY MAP
    # =====================================================

    def _cleaning_strategy(self, detected_type):
        return {
            "numeric":         "fill_numeric",
            "category":        "fill_mode",
            "date":            "forward_fill",
            "structured_code": "split_then_fill",
            "name":            "skip",
            "address":         "skip",
            "email":           "skip",
            "phone":           "skip",
            "text":            "skip",
        }.get(detected_type, "skip")
