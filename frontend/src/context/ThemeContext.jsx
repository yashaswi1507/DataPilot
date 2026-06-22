import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const LIGHT = {
  bgPage: "#F8F9FF", bgCard: "#FFFFFF", bgSidebar: "#13111E",
  textPrimary: "#111827", textMuted: "#6B7280", textLight: "#9CA3AF",
  border: "#E5E7EB", accent: "#6B5FED",
};

const DARK = {
  bgPage: "#0F0E17", bgCard: "#1A1825", bgSidebar: "#0A0912",
  textPrimary: "#F3F4F6", textMuted: "#9CA3AF", textLight: "#6B7280",
  border: "#2D2B3A", accent: "#8B7FF5",
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("dp_theme") || "light");

  useEffect(() => {
    localStorage.setItem("dp_theme", theme);
    const colors = theme === "dark" ? DARK : LIGHT;
    const root = document.documentElement;
    root.style.setProperty("--bg-page",    colors.bgPage);
    root.style.setProperty("--bg-card",    colors.bgCard);
    root.style.setProperty("--text-primary", colors.textPrimary);
    root.style.setProperty("--text-muted", colors.textMuted);
    root.style.setProperty("--text-light", colors.textLight);
    root.style.setProperty("--border",     colors.border);
    root.style.setProperty("--accent",     colors.accent);
    document.body.style.background = colors.bgPage;
    document.body.style.color = colors.textPrimary;
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "light" ? "dark" : "light"));
  const colors = theme === "dark" ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
