import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 min for ML training
});

// ── Upload ────────────────────────────────────────────────────
export const uploadFile = async (file, outlierOption = "No Action", missingOption = "Auto") => {
  const form = new FormData();
  form.append("file", file);
  form.append("outlier_option", outlierOption);
  form.append("missing_option", missingOption);
  const { data } = await api.post("/api/upload/file", form);
  return data;
};

export const uploadURL = async (url) => {
  const form = new FormData();
  form.append("url", url);
  const { data } = await api.post("/api/upload/url", form);
  return data;
};

// ── Clean ─────────────────────────────────────────────────────
export const cleanDataset = async (columns, rows, outlierOption, missingOption) => {
  const { data } = await api.post("/api/clean/process", {
    columns, data: rows, outlier_option: outlierOption, missing_option: missingOption,
  });
  return data;
};

export const downloadCleanedCSV = async (columns, rows) => {
  const response = await api.post("/api/clean/download",
    { columns, data: rows }, { responseType: "blob" }
  );
  const url  = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href  = url;
  link.download = "cleaned_data.csv";
  link.click();
  URL.revokeObjectURL(url);
};

// ── Query ─────────────────────────────────────────────────────
export const runQuery = async (columns, rows, query) => {
  const { data } = await api.post("/api/query/run", { columns, data: rows, query });
  return data;
};

// ── ML ────────────────────────────────────────────────────────
export const trainModel = async (columns, rows, target) => {
  const { data } = await api.post("/api/ml/train", { columns, data: rows, target });
  return data;
};

export const predictSingle = async (columns, rows, target, inputValues) => {
  const { data } = await api.post("/api/ml/predict", {
    columns, data: rows, target, input_values: inputValues,
  });
  return data;
};

export const suggestTarget = async (columns, rows) => {
  const { data } = await api.post("/api/ml/suggest-target", { columns, data: rows, target: "" });
  return data;
};

// ── Forecast ──────────────────────────────────────────────────
export const runForecast = async (columns, rows, valueCol, periods = 30, confidence = "95%") => {
  const { data } = await api.post("/api/forecast/run", {
    columns, data: rows, value_col: valueCol, periods, confidence,
  });
  return data;
};

// ── Anomaly ───────────────────────────────────────────────────
export const detectAnomalies = async (columns, rows, method = "iqr", threshold = 2.5) => {
  const { data } = await api.post("/api/anomaly/detect", {
    columns, data: rows, method, threshold,
  });
  return data;
};

// ── Visualize ─────────────────────────────────────────────────
export const getChartData = async (columns, rows, chartType, opts = {}) => {
  const { data } = await api.post("/api/visualize/chart-data", {
    columns, data: rows, chart_type: chartType, ...opts,
  });
  return data;
};

export const getSummary = async (columns, rows) => {
  const { data } = await api.post("/api/visualize/summary", { columns, data: rows });
  return data;
};

// ── Dashboard ─────────────────────────────────────────────────
export const getKPIs     = async (columns, rows) => {
  const { data } = await api.post("/api/dashboard/kpis",     { columns, data: rows }); return data;
};
export const getInsights = async (columns, rows) => {
  const { data } = await api.post("/api/dashboard/insights", { columns, data: rows }); return data;
};

// ── Export ────────────────────────────────────────────────────
export const exportReport = async (reportName, kpis, charts, insights, format = "pdf") => {
  const response = await api.post("/api/export/download",
    { report_name: reportName, kpis, charts, insights, format },
    { responseType: "blob" }
  );
  const ext  = format === "ppt" ? "pptx" : format;
  const url  = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href  = url;
  link.download = `${reportName}.${ext}`;
  link.click();
  URL.revokeObjectURL(url);
};

export default api;
