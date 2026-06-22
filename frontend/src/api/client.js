import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 min for ML training
});

// Auto-attach JWT token to every request (needed for /api/schedule, /api/user, etc.)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
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

export const uploadURL = async (url, kaggleCreds) => {
  const { data } = await api.post("/api/upload/url", {
    url,
    kaggle_username: kaggleCreds?.username || null,
    kaggle_key:      kaggleCreds?.key      || null,
  });
  return data;
};

// ── Multi-sheet Excel ────────────────────────────────────────
export const loadExcelSheet = async (sessionId, sheetName) => {
  const { data } = await api.post("/api/upload/excel/sheet", { session_id: sessionId, sheet_name: sheetName });
  return data;
};
export const joinExcelSheets = async (sessionId, leftSheet, rightSheet, leftOn, rightOn, how = "inner") => {
  const { data } = await api.post("/api/upload/excel/join", {
    session_id: sessionId, left_sheet: leftSheet, right_sheet: rightSheet,
    left_on: leftOn, right_on: rightOn || null, how,
  });
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

export const saveModel = async (columns, rows, target, modelName) => {
  const { data } = await api.post("/api/ml/save-model", { columns, data: rows, target, model_name: modelName || null });
  return data;
};

export const downloadModel = (modelId) => {
  window.open(`${BASE_URL}/api/ml/download-model/${modelId}`, "_blank");
};

export const getRecommendations = async (columns, rows) => {
  const { data } = await api.post("/api/dashboard/recommendations", { columns, data: rows });
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

// ── Organizations / Company Plans ────────────────────────────
export const listOrgPlans = async () => {
  const { data } = await api.get("/api/organizations/plans");
  return data;
};
export const createOrganization = async (name, plan, seats) => {
  const { data } = await api.post("/api/organizations/create", { name, plan, seats });
  return data;
};
export const getMyOrganization = async () => {
  const { data } = await api.get("/api/organizations/me");
  return data;
};
export const inviteMember = async (email) => {
  const { data } = await api.post("/api/organizations/invite", { email });
  return data;
};
export const revokeInvite = async (inviteId) => {
  const { data } = await api.post(`/api/organizations/revoke-invite/${inviteId}`);
  return data;
};
export const removeMember = async (memberUserId) => {
  const { data } = await api.post(`/api/organizations/remove-member/${memberUserId}`);
  return data;
};
export const updateSeats = async (seats) => {
  const { data } = await api.post(`/api/organizations/update-seats?seats=${seats}`);
  return data;
};

// ── External Database Connections ────────────────────────────
export const testDbConnection = async (config) => {
  const { data } = await api.post("/api/db/test", config);
  return data;
};
export const listDbTables = async (config) => {
  const { data } = await api.post("/api/db/tables", config);
  return data;
};
export const queryDb = async (config, tableName, customQuery, rowLimit = 5000) => {
  const { data } = await api.post("/api/db/query", { ...config, table_name: tableName, custom_query: customQuery, row_limit: rowLimit });
  return data;
};

// ── Google Sheets ─────────────────────────────────────────────
export const loadPublicSheet = async (sheetUrl, sheetName) => {
  const { data } = await api.post("/api/sheets/public", { sheet_url: sheetUrl, sheet_name: sheetName || null });
  return data;
};
export const loadPrivateSheet = async (sheetUrl, sheetName) => {
  const { data } = await api.post("/api/sheets/private", { sheet_url: sheetUrl, sheet_name: sheetName || null });
  return data;
};
export const getServiceAccountEmail = async () => {
  const { data } = await api.get("/api/sheets/service-account-email");
  return data;
};

// ── Annotations / Comments ───────────────────────────────────
export const createAnnotation = async (targetType, targetRef, commentText) => {
  const { data } = await api.post("/api/annotations/create", { target_type: targetType, target_ref: targetRef, comment_text: commentText });
  return data;
};
export const listAnnotations = async (targetType, targetRef) => {
  const { data } = await api.get("/api/annotations/list", { params: { target_type: targetType, target_ref: targetRef } });
  return data;
};
export const deleteAnnotation = async (id) => {
  const { data } = await api.delete(`/api/annotations/${id}`);
  return data;
};
export const detectTemplate = async (columns, rows) => {
  const { data } = await api.post("/api/templates/detect", { columns, data: rows });
  return data;
};
export const createSchedule = async (payload) => {
  const { data } = await api.post("/api/schedule/create", payload);
  return data;
};
export const listSchedules = async () => {
  const { data } = await api.get("/api/schedule/list");
  return data;
};
export const toggleSchedule = async (id) => {
  const { data } = await api.post(`/api/schedule/${id}/toggle`);
  return data;
};
export const deleteSchedule = async (id) => {
  const { data } = await api.delete(`/api/schedule/${id}`);
  return data;
};

export default api;
