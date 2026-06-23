import io, sys, zipfile, base64
import pandas as pd
from pydantic import BaseModel
from typing import List, Optional, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse

sys.path.append("..")
from engines.dataset_profiler import DatasetProfiler
from engines.preprocessing import DataPreprocessor

router = APIRouter()

# In-memory cache of the last-uploaded Excel workbook bytes, keyed by an
# upload session id, so the frontend can ask "what sheets does this have"
# and then "load sheet X" / "join sheet X and Y" without re-uploading the file.
# This is intentionally simple (single-process memory) — fine for a single
# Oracle VM deployment; would need Redis/S3 if scaled to multiple workers.
_workbook_cache: dict = {}


import math
import datetime as _datetime

def _sanitize_value(v):
    """
    Convert any non-JSON-compliant value to something JSON can represent:
    - NaN, +Inf, -Inf -> None (plain JSON has no representation for these)
    - datetime/date/Timestamp -> ISO 8601 string (Excel date columns load
      as Python datetime/pandas Timestamp objects, which Python's json
      module can't serialize on its own — this is what caused
      "Object of type datetime is not JSON serializable" on Excel uploads
      with date columns, e.g. order dates, signup dates, etc.)
    """
    if v is None:
        return None
    if isinstance(v, (_datetime.datetime, _datetime.date, pd.Timestamp)):
        if pd.isna(v):
            return None
        return v.isoformat()
    if isinstance(v, _datetime.time):
        return v.isoformat()
    if isinstance(v, _datetime.timedelta):
        return str(v)
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    # numpy scalar types (e.g. np.float64) — check via isinstance fallback
    try:
        fv = float(v)
        if isinstance(v, (int, str, bool)):
            return v
        if math.isnan(fv) or math.isinf(fv):
            return None
    except (TypeError, ValueError):
        pass
    return v


def _df_to_dict(df):
    # Replace NaN, +Inf, -Inf with None — plain JSON has no representation
    # for any of these, so leaving them in causes "Out of range float
    # values are not JSON compliant" errors on response serialization.
    # We sanitize value-by-value as a final safety net, since pandas'
    # .where(notnull) can miss numpy NaN variants in mixed-dtype frames.
    raw_rows = df.values.tolist()
    safe_rows = [[_sanitize_value(v) for v in row] for row in raw_rows]
    return {
        "columns": df.columns.tolist(),
        "data":    safe_rows,
        "shape":   list(df.shape),
        "dtypes":  {c: str(t) for c, t in df.dtypes.items()},
    }


def _load_csv(buf):
    for enc in ["utf-8", "latin1", "ISO-8859-1", "cp1252"]:
        for sep in [",", ";", "\t"]:
            try:
                buf.seek(0)
                df = pd.read_csv(buf, encoding=enc, sep=sep, on_bad_lines="skip")
                if len(df.columns) > 1:
                    return df
            except Exception:
                continue
    buf.seek(0)
    return pd.read_csv(buf)


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    outlier_option: str = Form("No Action"),
    missing_option: str = Form("Auto"),
):
    try:
        contents = await file.read()
        buf      = io.BytesIO(contents)
        fname    = file.filename.lower()

        if fname.endswith(".csv"):
            raw_df = _load_csv(buf)
        elif fname.endswith((".xlsx", ".xls")):
            engine = "openpyxl" if fname.endswith(".xlsx") else "xlrd"
            xl     = pd.ExcelFile(buf, engine=engine)

            if len(xl.sheet_names) > 1:
                # Multi-sheet workbook — cache raw bytes, return sheet list,
                # and let the frontend choose how to proceed (single sheet or join).
                session_id = base64.urlsafe_b64encode(contents[:16] + str(len(contents)).encode()).decode()[:24]
                _workbook_cache[session_id] = {"bytes": contents, "engine": engine, "filename": file.filename}

                sheet_previews = {}
                for sheet in xl.sheet_names:
                    try:
                        preview_df = xl.parse(sheet, nrows=5)
                        sheet_previews[sheet] = {
                            "columns": preview_df.columns.astype(str).tolist(),
                            "row_count_preview": len(preview_df),
                        }
                    except Exception:
                        sheet_previews[sheet] = {"columns": [], "row_count_preview": 0}

                return JSONResponse({
                    "success": True,
                    "multi_sheet": True,
                    "session_id": session_id,
                    "filename": file.filename,
                    "sheets": xl.sheet_names,
                    "sheet_previews": sheet_previews,
                })

            raw_df = xl.parse(xl.sheet_names[0])
        elif fname.endswith(".json"):
            raw_df = pd.read_json(buf)
        elif fname.endswith(".zip"):
            zf = zipfile.ZipFile(buf)
            for name in zf.namelist():
                if name.endswith(".csv"):
                    with zf.open(name) as f:
                        raw_df = pd.read_csv(f)
                    break
        else:
            raise HTTPException(400, f"Unsupported file type: {fname}")


        raw_df.columns = raw_df.columns.astype(str).str.strip()

        profiler        = DatasetProfiler(raw_df)
        dataset_type    = profiler.detect_dataset_type()
        column_profiles = profiler.profile_columns()
        recommendations = profiler.get_recommendations()

        processor        = DataPreprocessor(raw_df, outlier_option, missing_option, dataset_type, column_profiles)
        clean_df, report = processor.process()

        profiles_out = {
            col: {
                "detected_type":     p.get("detected_type", ""),
                "cleaning_strategy": p.get("cleaning_strategy", ""),
                "missing_count":     int(p.get("missing_count", 0)),
                "missing_percent":   float(p.get("missing_percent", 0)),
                "unique_count":      int(p.get("unique_count", 0)),
            }
            for col, p in column_profiles.items()
        }

        return JSONResponse({
            "success":         True,
            "filename":        file.filename,
            "raw":             _df_to_dict(raw_df),
            "clean":           _df_to_dict(clean_df),
            "dataset_type":    dataset_type,
            "column_profiles": profiles_out,
            "report":          report,
            "raw_missing":     int(raw_df.isnull().sum().sum()),
            "clean_missing":   int(clean_df.isnull().sum().sum()),
            "recommendations": recommendations,
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


class URLPayload(BaseModel):
    url: str
    kaggle_username: Optional[str] = None
    kaggle_key: Optional[str] = None

@router.post("/url")
async def upload_url(payload: URLPayload):
    import requests as req
    from bs4 import BeautifulSoup
    url = payload.url.strip()
    try:
        headers = {"User-Agent": "Mozilla/5.0"}

        # IMPORTANT: check Kaggle URLs FIRST. A Kaggle dataset URL often
        # contains literal ".csv" text (e.g. "?select=dataset_2.csv" query
        # param) which would otherwise wrongly match the generic CSV branch
        # below — and Kaggle's HTML page would get downloaded as if it were
        # a CSV, producing a confusing "Expected N fields" tokenizer error.
        if "kaggle.com" in url:
            # Extract dataset identifier from URL
            # e.g. https://www.kaggle.com/datasets/username/dataset-name
            import re, tempfile, os as _os
            match = re.search(r'kaggle\.com/datasets/([^/]+/[^/?]+)', url)
            if not match:
                raise HTTPException(400, "Invalid Kaggle URL. Format: https://www.kaggle.com/datasets/username/dataset-name")

            dataset_id = match.group(1)

            # Credential priority: request body (from the Kaggle Connect tab)
            # takes priority over server-wide .env vars, which take priority
            # over a kaggle.json file on disk. This lets each user bring
            # their own Kaggle account via the "Connect Kaggle" flow without
            # needing the server admin to configure anything.
            kaggle_user = payload.kaggle_username or _os.environ.get("KAGGLE_USERNAME")
            kaggle_key  = payload.kaggle_key      or _os.environ.get("KAGGLE_KEY")

            kaggle_dir = _os.path.expanduser("~/.kaggle")
            creds_file = _os.path.join(kaggle_dir, "kaggle.json")

            if not kaggle_user or not kaggle_key:
                if not _os.path.exists(creds_file):
                    raise HTTPException(400,
                        "This is a Kaggle dataset. Kaggle requires an account to download "
                        "data, so pasting the link alone is not enough. Use the 'Connect "
                        "Kaggle Account' option below to add your username and API key, "
                        "or download the file manually from Kaggle and upload it directly."
                    )

            # If credentials came from the request, set them as env vars for
            # this call so the kaggle library (which reads from env/kaggle.json
            # internally) picks them up.
            if payload.kaggle_username and payload.kaggle_key:
                _os.environ["KAGGLE_USERNAME"] = payload.kaggle_username
                _os.environ["KAGGLE_KEY"]      = payload.kaggle_key

            try:
                import kaggle
                with tempfile.TemporaryDirectory() as tmpdir:
                    kaggle.api.authenticate()
                    kaggle.api.dataset_download_files(dataset_id, path=tmpdir, unzip=True)

                    # Check if a specific file was requested via ?select=filename.csv
                    select_match = re.search(r'[?&]select=([^&]+)', url)
                    wanted_file = select_match.group(1) if select_match else None

                    csv_files = []
                    for root, dirs, files in _os.walk(tmpdir):
                        for f in files:
                            if f.endswith((".csv",".xlsx",".json")):
                                csv_files.append(_os.path.join(root, f))

                    if not csv_files:
                        raise HTTPException(400, "No CSV/Excel/JSON files found in Kaggle dataset.")

                    if wanted_file:
                        matched = [f for f in csv_files if _os.path.basename(f) == wanted_file]
                        target_file = matched[0] if matched else max(csv_files, key=lambda f: _os.path.getsize(f))
                    else:
                        target_file = max(csv_files, key=lambda f: _os.path.getsize(f))

                    if target_file.endswith(".csv"):
                        df = pd.read_csv(target_file)
                    elif target_file.endswith(".xlsx"):
                        df = pd.read_excel(target_file, engine="openpyxl")
                    else:
                        df = pd.read_json(target_file)

            except HTTPException:
                raise
            except Exception as ke:
                raise HTTPException(500,
                    f"Kaggle download failed: {str(ke)}. "
                    "If credentials are missing/invalid, download the CSV manually from Kaggle and upload it directly instead."
                )

        elif ".csv" in url or "raw.githubusercontent" in url or "drive.google" in url:
            # Robust CSV loading — real-world CSVs from random URLs are often
            # malformed (extra commas in free-text fields, mixed delimiters,
            # inconsistent quoting). Try strict parsing first, then progressively
            # more lenient strategies instead of failing outright.
            resp = req.get(url, headers=headers, timeout=15)
            if resp.status_code != 200:
                raise HTTPException(400, f"URL returned status {resp.status_code} — check the link is publicly accessible.")

            csv_bytes = resp.content
            if not csv_bytes or len(csv_bytes) < 5:
                raise HTTPException(400, "URL returned an empty response.")

            # If the server actually sent back an HTML error page (common when
            # a "direct CSV link" is actually a login/redirect page), catch it
            # explicitly instead of letting pandas produce a confusing tokenizer error.
            sniff = csv_bytes[:200].lower()
            if b"<html" in sniff or b"<!doctype" in sniff:
                raise HTTPException(400,
                    "This URL returned a webpage, not a CSV file. Make sure you're using "
                    "a direct download link (often ends in .csv) and that the file is public."
                )

            df = None
            last_error = None

            # Order matters: try comma-skip BEFORE auto-detect delimiter.
            # Auto-detect (sep=None) can misfire on genuinely single-column
            # files with one stray comma, splitting on the wrong character
            # entirely and producing garbage. Comma-skip-bad-lines is safer
            # for the common case (one or two malformed rows in an otherwise
            # consistent comma-separated file).
            attempts = [
                {"sep": ",", "on_bad_lines": "error", "engine": "c"},
                {"sep": ",", "on_bad_lines": "skip",  "engine": "python"},
                {"sep": ";",  "on_bad_lines": "skip",  "engine": "python"},
                {"sep": "\t", "on_bad_lines": "skip",  "engine": "python"},
                {"sep": None, "on_bad_lines": "skip", "engine": "python"},  # auto-detect, last resort
            ]
            for opts in attempts:
                try:
                    candidate = pd.read_csv(io.BytesIO(csv_bytes), **opts)
                    if candidate.shape[1] >= 1 and candidate.shape[0] > 0:
                        df = candidate
                        break
                except Exception as e:
                    last_error = str(e)
                    continue

            if df is None or df.shape[1] == 0:
                raise HTTPException(400,
                    "Could not parse this CSV after trying multiple strategies "
                    f"(comma/semicolon/tab, strict/lenient). Last error: {last_error or 'unknown'}. "
                    "Try downloading and re-uploading the file directly instead."
                )
        elif ".xlsx" in url:
            df = pd.read_excel(url, engine="openpyxl")
        elif ".json" in url:
            r  = req.get(url, headers=headers, timeout=15)
            df = pd.DataFrame(r.json())
        else:
            # Try HTML tables first
            try:
                tables = pd.read_html(url)
                if tables:
                    df = max(tables, key=lambda t: t.shape[0] * t.shape[1])
                else:
                    raise ValueError("No tables")
            except Exception:
                # Web scraping fallback
                r    = req.get(url, headers=headers, timeout=15)
                soup = BeautifulSoup(r.text, "html.parser")
                for tag in soup(["script","style","nav","footer"]):
                    tag.decompose()
                paras = [p.get_text().strip() for p in soup.find_all("p") if len(p.get_text().strip()) > 20]
                if not paras:
                    raise HTTPException(400, "No data found at URL")
                df = pd.DataFrame({"Text": paras[:200]})

        df.columns = df.columns.astype(str).str.strip()

        return JSONResponse({
            "success":  True,
            "filename": url.split("/")[-1][:50] or "url_data",
            "raw":      _df_to_dict(df),
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Could not load URL: {str(e)}")


# ── Multi-sheet Excel handling ──────────────────────────────────

class LoadSheetPayload(BaseModel):
    session_id: str
    sheet_name: str


@router.post("/excel/sheet")
def load_excel_sheet(payload: LoadSheetPayload):
    """Load a single sheet from a cached multi-sheet workbook."""
    cached = _workbook_cache.get(payload.session_id)
    if not cached:
        raise HTTPException(404, "Workbook session expired. Please re-upload the file.")
    try:
        buf = io.BytesIO(cached["bytes"])
        df  = pd.read_excel(buf, sheet_name=payload.sheet_name, engine=cached["engine"])
        df.columns = df.columns.astype(str).str.strip()
        return JSONResponse({
            "success":  True,
            "filename": f"{cached['filename']} — {payload.sheet_name}",
            "raw":      _df_to_dict(df),
        })
    except Exception as e:
        raise HTTPException(500, f"Could not load sheet: {e}")


class JoinSheetsPayload(BaseModel):
    session_id:   str
    left_sheet:   str
    right_sheet:  str
    left_on:      str
    right_on:     Optional[str] = None   # defaults to left_on if same column name
    how:          str = "inner"          # inner / left / right / outer


@router.post("/excel/join")
def join_excel_sheets(payload: JoinSheetsPayload):
    """
    Join two sheets from the same workbook on a key column — e.g. join a
    'Sales' sheet to a 'Customers' sheet on 'CustomerID', similar to an
    Excel VLOOKUP / Power Query merge.
    """
    cached = _workbook_cache.get(payload.session_id)
    if not cached:
        raise HTTPException(404, "Workbook session expired. Please re-upload the file.")
    if payload.how not in ("inner", "left", "right", "outer"):
        raise HTTPException(400, "how must be one of: inner, left, right, outer")

    try:
        buf = io.BytesIO(cached["bytes"])
        left_df  = pd.read_excel(buf, sheet_name=payload.left_sheet, engine=cached["engine"])
        buf.seek(0)
        right_df = pd.read_excel(buf, sheet_name=payload.right_sheet, engine=cached["engine"])

        left_df.columns  = left_df.columns.astype(str).str.strip()
        right_df.columns = right_df.columns.astype(str).str.strip()

        right_on = payload.right_on or payload.left_on
        if payload.left_on not in left_df.columns:
            raise HTTPException(400, f"Column '{payload.left_on}' not found in sheet '{payload.left_sheet}'")
        if right_on not in right_df.columns:
            raise HTTPException(400, f"Column '{right_on}' not found in sheet '{payload.right_sheet}'")

        merged = pd.merge(
            left_df, right_df,
            left_on=payload.left_on, right_on=right_on,
            how=payload.how, suffixes=("", f"_{payload.right_sheet}"),
        )

        return JSONResponse({
            "success":  True,
            "filename": f"{cached['filename']} — {payload.left_sheet} ⋈ {payload.right_sheet}",
            "raw":      _df_to_dict(merged),
            "rows_before": {"left": len(left_df), "right": len(right_df)},
            "rows_after":  len(merged),
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Join failed: {e}")
