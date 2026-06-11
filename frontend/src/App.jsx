import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Sidebar from "./components/layout/Sidebar";
import Topbar  from "./components/layout/Topbar";
import Dashboard from "./pages/Dashboard";

// Placeholder pages — will be built out
const Placeholder = ({ title }) => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">🚧</span>
      </div>
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <p className="text-sm text-gray-400 mt-1">Coming soon</p>
    </div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-52">
          <Topbar />
          <main className="pt-14 p-6 min-h-screen">
            <Routes>
              <Route path="/"                  element={<Dashboard />} />
              <Route path="/overview"          element={<Placeholder title="Data Overview" />} />
              <Route path="/insights"          element={<Placeholder title="Insights & EDA" />} />
              <Route path="/charts"            element={<Placeholder title="Charts Studio" />} />
              <Route path="/query"             element={<Placeholder title="Ask Your Data" />} />
              <Route path="/prep/clean"        element={<Placeholder title="Data Cleaning" />} />
              <Route path="/prep/missing"      element={<Placeholder title="Missing Value Handling" />} />
              <Route path="/prep/duplicates"   element={<Placeholder title="Duplicate Removal" />} />
              <Route path="/prep/outliers"     element={<Placeholder title="Outlier Detection" />} />
              <Route path="/prep/types"        element={<Placeholder title="Data Type Fixes" />} />
              <Route path="/ml/testing"        element={<Placeholder title="Model Testing" />} />
              <Route path="/ml/comparison"     element={<Placeholder title="Model Comparison" />} />
              <Route path="/ml/predict"        element={<Placeholder title="Predictions" />} />
              <Route path="/ml/features"       element={<Placeholder title="Feature Importance" />} />
              <Route path="/forecast/predict"  element={<Placeholder title="Future Predictions" />} />
              <Route path="/forecast/scenarios"element={<Placeholder title="Scenario Analysis" />} />
              <Route path="/reports"           element={<Placeholder title="Reports" />} />
              <Route path="/settings"          element={<Placeholder title="Settings" />} />
              <Route path="/help"              element={<Placeholder title="Help & Support" />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
