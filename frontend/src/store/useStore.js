import { create } from "zustand";

const useStore = create((set, get) => ({
  // ── Dataset state ─────────────────────────────────────────
  rawData:      null,   // { columns, data, shape, filename }
  cleanData:    null,   // { columns, data, shape }
  cleanReport:  [],     // cleaning report lines
  datasetType:  "",
  columnProfiles: {},
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
  setRawData:     (d) => set({ rawData: d }),
  setCleanData:   (d) => set({ cleanData: d }),
  setCleanReport: (r) => set({ cleanReport: r }),
  setDatasetType: (t) => set({ datasetType: t }),
  setColumnProfiles: (p) => set({ columnProfiles: p }),
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

  resetAll: () => set({
    rawData: null, cleanData: null, cleanReport: [], datasetType: "",
    columnProfiles: {}, mlResult: null, mlTarget: "", forecastResult: null,
    anomalyResult: null, queryHistory: [], pinnedCharts: [], activity: [],
  }),

  // Helper — get active data (clean if available, else raw)
  getActiveData: () => {
    const { cleanData, rawData } = get();
    return cleanData || rawData;
  },
}));

export default useStore;
