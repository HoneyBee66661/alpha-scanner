/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#000000",
          card: "#111114",
          row: "#16161a",
          hover: "#1c1c22",
          raised: "#1e1e22",
          input: "#1e1e24",
          dropdown: "#1a1a20",
        },
        border: {
          DEFAULT: "#2a2a30",
          focus: "#3b82f6",
        },
        text: {
          primary: "#f0f0f0",
          secondary: "#9d9da3",
          muted: "#5f5f66",
        },
        signal: {
          green: "#22c55e",
          greenBg: "rgba(34,197,94,0.15)",
          red: "#ef4444",
          redBg: "rgba(239,68,68,0.15)",
          blue: "#3b82f6",
          blueBg: "rgba(59,130,246,0.15)",
          yellow: "#eab308",
          yellowBg: "rgba(234,179,8,0.15)",
          orange: "#f97316",
          orangeBg: "rgba(249,115,22,0.15)",
        },
      },
      fontSize: {
        brand: ["22px", { lineHeight: "28px", letterSpacing: "0.5px", fontWeight: "700" }],
        heading: ["16px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["13px", { lineHeight: "20px" }],
        cell: ["12px", { lineHeight: "16px" }],
        score: ["13px", { lineHeight: "18px", fontWeight: "700" }],
        label: ["11px", { lineHeight: "14px", fontWeight: "500", letterSpacing: "0.3px" }],
        mono: ["12px", { lineHeight: "16px", fontVariantNumeric: "tabular-nums" }],
      },
      borderRadius: {
        pill: "8px",
      },
    },
  },
  plugins: [],
};
