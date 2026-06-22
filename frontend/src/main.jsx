import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply saved theme before first paint to avoid flash
if (localStorage.getItem("dp_theme") === "dark") {
  document.body.classList.add("dark-mode");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
