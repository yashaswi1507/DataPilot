import { create } from "zustand";

const useStore = create((set, get) => ({
  // ── Auth state ────────────────────────────────────────────
  user:  JSON.parse(localStorage.getItem("dp_user") || "null"),
  token: localStorage.getItem("dp_token") || null,
  setUser:  (u) => set({ user: u }),
  setToken: (t) => set({ token: t }),
  isLoggedIn: () => !!get().token,

  // ── Plan / usage state ───────────────────────────────────────
  // PLAN_LIMITS: how many datasets each plan allows per period
  planLimits: { free: 10, basic: 50, pro: 999999 },
  datasetsUsed: Number(localStorage.getItem("dp_datasets_used") || 0),
  incrementDatasetsUsed: () => {
    const next = get().datasetsUsed + 1;
    localStorage.setItem("dp_datasets_used", String(next));
    set({ datasetsUsed: next });
  },
  getPlanInfo: () => {
    const plan  = get().user?.plan || "free";
    const limit = get().planLimits[plan] ?? 10;
    const used  = get().datasetsUsed;
    return { plan, limit, used, pct: Math.min(100, Math.round((used/limit)*100)) };
  },

  // ── Dataset state ─────────────────────────────────────────
  rawData:      JSON.parse(sessionStorage.getItem("dp_rawData") || "null"),
  cleanData:    JSON.parse(sessionStorage.getItem("dp_cleanData") || "null"),
  cleanReport:  [],
  datasetType:  sessionStorage.getItem("dp_datasetType") || "",
  columnProfiles: JSON.parse(sessionStorage.getItem("dp_profiles") || "{}"),
  isUploading:  false,
  isCleaning:   false,

  // ── ML state ──────────────────────────────────────────────
  mlResult:     null,
  mlTarget:     "",
  isTraining:   false,

  // ── Forecast state ────────────────────────────────────────
  forecastResult: null,
  isForecasting:  false,

  // ── Anomaly state ─────────────────────────────────────────
  anomalyResult:  null,

  // ── Query state ───────────────────────────────────────────
  queryHistory: [],

  // ── Reports state ─────────────────────────────────────────
  savedReports: [],
  pinnedCharts: [],

  // ── Activity log ──────────────────────────────────────────
  activity: [],

  // ── Actions ───────────────────────────────────────────────
  // Try sessionStorage, but always keep in-memory state as source of truth.
  // Large datasets skip persistence (silently) — in-memory state still works
  // for the current tab; only full-page navigation away+back would lose it.
  _trySave: (key, value) => {
    try {
      sessionStorage.removeItem(key);
      sessionStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  },
  setRawData:     (d) => { get()._trySave("dp_rawData", JSON.stringify(d)); set({ rawData: d, cleanHistory: [], historyIndex: -1 }); },
  setCleanData:   (d) => {
    get()._trySave("dp_cleanData", JSON.stringify(d));
    // Push to undo history (keep last 10 states, drop any "future" states if we branched)
    const { cleanHistory, historyIndex } = get();
    const truncated = cleanHistory.slice(0, historyIndex + 1);
    const next = [...truncated, d].slice(-10);
    set({ cleanData: d, cleanHistory: next, historyIndex: next.length - 1 });
  },
  setCleanReport: (r) => set({ cleanReport: r }),

  // ── Undo/Redo for cleaning steps ──────────────────────────
  cleanHistory: [],
  historyIndex: -1,
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().cleanHistory.length - 1,
  undoClean: () => {
    const { cleanHistory, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prevIdx = historyIndex - 1;
    const prevState = prevIdx === 0 ? null : cleanHistory[prevIdx];
    get()._trySave("dp_cleanData", JSON.stringify(prevState));
    set({ cleanData: prevState, historyIndex: prevIdx });
  },
  redoClean: () => {
    const { cleanHistory, historyIndex } = get();
    if (historyIndex >= cleanHistory.length - 1) return;
    const nextIdx = historyIndex + 1;
    const nextState = cleanHistory[nextIdx];
    get()._trySave("dp_cleanData", JSON.stringify(nextState));
    set({ cleanData: nextState, historyIndex: nextIdx });
  },
  setDatasetType: (t) => { get()._trySave("dp_datasetType", t||""); set({ datasetType: t }); },
  setColumnProfiles: (p) => { get()._trySave("dp_profiles", JSON.stringify(p)); set({ columnProfiles: p }); },
  setIsUploading: (v) => set({ isUploading: v }),
  setIsCleaning:  (v) => set({ isCleaning: v }),
  setMlResult:    (r) => set({ mlResult: r }),
  setMlTarget:    (t) => set({ mlTarget: t }),
  setIsTraining:  (v) => set({ isTraining: v }),
  setForecastResult: (r) => set({ forecastResult: r }),
  setIsForecasting:  (v) => set({ isForecasting: v }),
  setAnomalyResult:  (r) => set({ anomalyResult: r }),

  addQueryToHistory: (q) => set((s) => ({
    queryHistory: [q, ...s.queryHistory].slice(0, 20),
  })),

  addActivity: (action) => set((s) => ({
    activity: [
      { action, time: new Date().toLocaleTimeString(), id: Date.now() },
      ...s.activity,
    ].slice(0, 10),
  })),

  saveReport: (name, charts, insights, kpis) => set((s) => ({
    savedReports: [...s.savedReports, { name, charts, insights, kpis, id: Date.now() }],
  })),

  pinChart: (chart) => set((s) => ({
    pinnedCharts: [...s.pinnedCharts, { ...chart, id: Date.now() }],
  })),

  unpinChart: (id) => set((s) => ({
    pinnedCharts: s.pinnedCharts.filter((c) => c.id !== id),
  })),

  resetAll: () => {
    sessionStorage.removeItem("dp_rawData");
    sessionStorage.removeItem("dp_cleanData");
    sessionStorage.removeItem("dp_datasetType");
    sessionStorage.removeItem("dp_profiles");
    set({
      rawData: null, cleanData: null, cleanReport: [], datasetType: "",
      columnProfiles: {}, mlResult: null, mlTarget: "", forecastResult: null,
      anomalyResult: null, queryHistory: [], pinnedCharts: [], activity: [],
    });
  },

  // Helper — get active data (clean if available, else raw)
  getActiveData: () => {
    const { cleanData, rawData } = get();
    return cleanData || rawData;
  },
}));

export default useStore;
