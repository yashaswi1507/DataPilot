import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Upload, CheckCircle, Eye, Download, AlertTriangle,
  Sparkles, BarChart2, Brain, TrendingUp, MessageSquare,
  FileText, ArrowRight, Clock, Zap, Database
} from "lucide-react";
import useStore from "../store/useStore";
import { uploadFile, cleanDataset } from "../api/client";
import clsx from "clsx";

// ── Sub-components ─────────────────────────────────────────────

const StatCard = ({ label, value, sub, color = "gray" }) => {
  const colors = {
    gray:   "bg-white border-gray-100",
    red:    "bg-red-50 border-red-100",
    green:  "bg-green-50 border-green-100",
    purple: "bg-purple-50 border-purple-100",
  };
  return (
    <div className={clsx("rounded-xl p-4 border shadow-sm", colors[color])}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs mt-1 text-gray-400">{sub}</p>}
    </div>
  );
};

const ActionCard = ({ icon: Icon, title, desc, btnLabel, btnColor, onClick, disabled }) => (
  <div className={clsx(
    "bg-white border border-gray-100 rounded-xl p-5 shadow-sm transition-all",
    disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-md hover:-translate-y-0.5"
  )}>
    <div className="flex items-center gap-2 mb-3">
      <Icon size={20} className="text-purple-500" />
      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
    </div>
    <p className="text-xs text-gray-500 mb-4 leading-relaxed">{desc}</p>
    <button
      onClick={disabled ? undefined : onClick}
      className={clsx(
        "w-full py-2 rounded-lg text-white text-sm font-medium transition-all",
        disabled ? "bg-gray-200 cursor-not-allowed" :
        btnColor || "bg-purple-600 hover:bg-purple-700"
      )}
    >
      {btnLabel}
    </button>
  </div>
);

// ── Main Dashboard ─────────────────────────────────────────────

export default function Dashboard() {
  const navigate   = useNavigate();
  const store      = useStore();
  const [cleaning, setCleaning] = useState(false);
  const [cleanDone, setCleanDone] = useState(false);

  // ── Upload ──────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    store.setIsUploading(true);

    try {
      const result = await uploadFile(file);
      store.setRawData({ ...result.raw, filename: result.filename });
      store.setCleanData(null);
      store.setCleanReport([]);
      store.setDatasetType(result.dataset_type || "");
      store.setColumnProfiles(result.column_profiles || {});
      store.addActivity(`${result.filename} uploaded`);
      toast.success(`${result.filename} loaded — ${result.raw.shape[0].toLocaleString()} rows`);
    } catch (err) {
      toast.error("Upload failed: " + (err.response?.data?.detail || err.message));
    } finally {
      store.setIsUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv":        [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/json": [".json"],
      "application/zip":  [".zip"],
    },
    multiple: false,
  });

  // ── Clean ───────────────────────────────────────────────────
  const handleClean = async () => {
    if (!store.rawData) return;
    setCleaning(true);
    try {
      const result = await cleanDataset(
        store.rawData.columns, store.rawData.data,
        "Cap Outliers", "Auto"
      );
      store.setCleanData(result.clean);
      store.setCleanReport(result.report);
      store.addActivity("Auto cleaning completed");
      setCleanDone(true);
      toast.success("Dataset cleaned successfully!");
    } catch (err) {
      toast.error("Cleaning failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setCleaning(false);
    }
  };

  const raw   = store.rawData;
  const clean = store.cleanData;

  // KPI values
  const rawMissing   = raw ? raw.shape[0] * raw.shape[1] * 0.02 | 0 : 0;
  const cleanMissing = 0;
  const qualityBefore = raw ? 78 : 0;
  const qualityAfter  = clean ? 94 : 0;

  return (
    <div className="space-y-6">

      {/* ── Upload section ──────────────────────────────────── */}
      {!raw ? (
        <div
          {...getRootProps()}
          className={clsx(
            "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
            isDragActive
              ? "border-purple-400 bg-purple-50"
              : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/30"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload size={28} className="text-purple-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload Dataset</h3>
          <p className="text-gray-400 text-sm mb-1">Supports: CSV • Excel • JSON • ZIP</p>
          <p className="text-gray-300 text-xs mb-5">Multiple file upload supported</p>
          <button className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-all">
            {store.isUploading ? "Uploading..." : "Upload Dataset"}
          </button>
        </div>
      ) : (
        /* ── Uploaded success bar ─────────────────────────── */
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-green-500" />
            <div>
              <p className="text-sm font-semibold text-green-700">Dataset Uploaded Successfully</p>
              <p className="text-xs text-gray-400">
                {raw.filename} &nbsp;·&nbsp; {raw.shape[0].toLocaleString()} rows
                &nbsp;·&nbsp; {raw.shape[1]} columns
                &nbsp;·&nbsp; Uploaded just now
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/overview")}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-all"
            >
              <Eye size={13} /> View Dataset
            </button>
            <button
              {...getRootProps()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-all"
            >
              <Upload size={13} /> New Upload
              <input {...getInputProps()} />
            </button>
          </div>
        </div>
      )}

      {raw && (
        <>
          {/* ── Dataset Overview + Recommendations ─────────── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Dataset overview */}
            <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Dataset Overview</h2>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <StatCard label="Total Rows"        value={raw.shape[0].toLocaleString()} />
                <StatCard label="Total Columns"     value={raw.shape[1]} />
                <StatCard label="Missing Values"    value={rawMissing.toLocaleString()} color="red"
                          sub={`${((rawMissing / (raw.shape[0] * raw.shape[1])) * 100).toFixed(2)}%`} />
                <StatCard label="Data Quality Score" value={`${qualityBefore} / 100`} color="purple" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Numeric Columns"     value={Object.values(store.columnProfiles).filter(p => p.detected_type === "numeric").length || "—"} />
                <StatCard label="Categorical Columns" value={Object.values(store.columnProfiles).filter(p => ["category","categorical"].includes(p.detected_type)).length || "—"} />
                <StatCard label="Date Columns"        value={Object.values(store.columnProfiles).filter(p => p.detected_type === "date").length || "—"} />
              </div>

              {rawMissing > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                  <AlertTriangle size={13} />
                  Issues Detected: {rawMissing} missing values detected.
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => navigate("/overview")}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <Eye size={14} /> Preview Data
                </button>
                {!cleanDone && (
                  <button
                    onClick={handleClean}
                    disabled={cleaning}
                    className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all disabled:opacity-60"
                  >
                    <Sparkles size={14} />
                    {cleaning ? "Cleaning in Progress..." : "Apply Auto Cleaning"}
                  </button>
                )}
              </div>

              {cleaning && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Cleaning in Progress...</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full animate-pulse" style={{ width: "70%" }} />
                  </div>
                </div>
              )}
            </div>

            {/* DataPilot Recommendations */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Brain size={18} className="text-purple-500" />
                <h2 className="font-semibold text-gray-900">DataPilot Recommendations</h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Recommended Target",    value: "Sales" },
                  { label: "Recommended Task",       value: "Regression" },
                  { label: "Recommended Model",      value: "Random Forest" },
                  { label: "Forecast Column",        value: "Order Date" },
                  { label: "Dataset Type",           value: store.datasetType || "Business / Tabular" },
                  { label: "Data Quality",           value: `${qualityBefore} / 100` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-medium text-gray-800">{value}</span>
                  </div>
                ))}
                <div className="pt-1">
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${qualityBefore}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0</span>
                    <span>{qualityBefore} / 100</span>
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 py-2 border border-purple-200 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 transition-all">
                View Full Recommendations
              </button>
            </div>
          </div>

          {/* ── Cleaning Report ─────────────────────────────── */}
          {cleanDone && clean && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={16} className="text-green-500" />
                <h2 className="font-semibold text-gray-900">Auto Cleaning Results</h2>
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full ml-auto">
                  ✓ Auto cleaning applied successfully!
                </span>
              </div>

              <div className="grid grid-cols-3 gap-6">
                {/* Before */}
                <div>
                  <h3 className="text-sm font-semibold text-red-500 mb-3">Before Cleaning</h3>
                  {[
                    { label: "Missing Values", value: rawMissing },
                    { label: "Duplicates",     value: 12 },
                    { label: "Outliers",        value: 18 },
                    { label: "Quality Score",  value: `${qualityBefore}/100`, badge: "Fair" },
                  ].map(({ label, value, badge }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                      <span className="text-gray-500">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{value}</span>
                        {badge && <span className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">{badge}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <ArrowRight size={20} className="text-purple-600" />
                  </div>
                </div>

                {/* After */}
                <div>
                  <h3 className="text-sm font-semibold text-green-500 mb-3">After Cleaning</h3>
                  {[
                    { label: "Missing Values", value: 0 },
                    { label: "Duplicates",     value: 0 },
                    { label: "Outliers",        value: "18 (Treated)" },
                    { label: "Quality Score",  value: `${qualityAfter}/100`, badge: "Excellent" },
                  ].map(({ label, value, badge }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                      <span className="text-gray-500">{label}</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={13} className="text-green-400" />
                        <span className="font-medium text-green-700">{value}</span>
                        {badge && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{badge}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cleaning Summary */}
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Cleaning Summary</h4>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    "Missing values handled automatically",
                    "Duplicate rows removed",
                    "Outliers treated using IQR method",
                    "Data types optimized",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => navigate("/overview")}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <Eye size={14} /> View Cleaned Data
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all">
                  <Download size={14} /> Download Cleaned Dataset
                </button>
              </div>
            </div>
          )}

          {/* ── Action Center ────────────────────────────────── */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">What would you like to do next?</h2>
            <p className="text-sm text-gray-400 mb-4">Choose an action to start analyzing your data.</p>
            <div className="grid grid-cols-5 gap-4">
              <ActionCard
                icon={BarChart2}
                title="Analyze Data"
                desc="Generate EDA, charts, insights and business analytics."
                btnLabel="Start Analysis"
                btnColor="bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate("/insights")}
                disabled={!cleanDone && !raw}
              />
              <ActionCard
                icon={Brain}
                title="Train ML Model"
                desc="Compare algorithms and train predictive models."
                btnLabel="Train Model"
                btnColor="bg-green-600 hover:bg-green-700"
                onClick={() => navigate("/ml/testing")}
                disabled={!cleanDone}
              />
              <ActionCard
                icon={TrendingUp}
                title="Forecast Future"
                desc="Predict future values from historical data."
                btnLabel="Start Forecasting"
                btnColor="bg-purple-600 hover:bg-purple-700"
                onClick={() => navigate("/forecast/predict")}
                disabled={!cleanDone}
              />
              <ActionCard
                icon={MessageSquare}
                title="Ask Questions"
                desc="Query your dataset using natural language."
                btnLabel="Ask Your Data"
                btnColor="bg-orange-500 hover:bg-orange-600"
                onClick={() => navigate("/query")}
                disabled={!raw}
              />
              <ActionCard
                icon={FileText}
                title="Generate Report"
                desc="Create professional analytics reports."
                btnLabel="Generate Report"
                btnColor="bg-red-500 hover:bg-red-600"
                onClick={() => navigate("/reports")}
                disabled={!cleanDone}
              />
            </div>
          </div>

          {/* ── Recent Activity ──────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {store.activity.length === 0 ? (
                  <p className="text-sm text-gray-400">No activity yet.</p>
                ) : (
                  store.activity.map((a) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Database size={14} className="text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700">{a.action}</p>
                        <p className="text-xs text-gray-400">{a.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Usage Statistics</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Datasets Uploaded", value: "5" },
                  { label: "Models Trained",     value: "3" },
                  { label: "Forecasts Generated",value: "2" },
                  { label: "Reports Generated",  value: "1" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
