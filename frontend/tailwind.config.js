/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary:   { DEFAULT: "#6B5FED", dark: "#4F46C8", light: "#EEF0FF" },
        sidebar:   { DEFAULT: "#1E1B4B", hover: "#2D2A5E", active: "#3730A3" },
        success:   "#10B981",
        warning:   "#F59E0B",
        danger:    "#EF4444",
        info:      "#3B82F6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card:  "0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)",
        modal: "0 20px 60px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
}
