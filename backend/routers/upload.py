import io, sys, zipfile
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse

sys.path.append("..")
from engines.dataset_profiler import DatasetProfiler
from engines.preprocessing import DataPreprocessor

router = APIRouter()


def _df_to_dict(df):
    return {
        "columns": df.columns.tolist(),
        "data":    df.where(pd.notnull(df), None).values.tolist(),
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
        elif fname.endswith(".xlsx"):
            raw_df = pd.read_excel(buf, engine="openpyxl")
        elif fname.endswith(".xls"):
            raw_df = pd.read_excel(buf, engine="xlrd")
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
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/url")
async def upload_url(url: str = Form(...)):
    import requests as req
    try:
        if ".csv" in url:
            df = pd.read_csv(url)
        elif ".xlsx" in url:
            df = pd.read_excel(url, engine="openpyxl")
        elif ".json" in url:
            r  = req.get(url, timeout=15)
            df = pd.DataFrame(r.json())
        else:
            tables = pd.read_html(url)
            if not tables:
                raise HTTPException(400, "No table found at URL")
            df = max(tables, key=lambda t: t.shape[0])

        return JSONResponse({
            "success":  True,
            "filename": url.split("/")[-1][:50],
            "raw":      _df_to_dict(df),
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Could not load URL: {e}")
