/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effcf9", 100: "#c9f5ec", 200: "#94eadb", 300: "#57d8c5", 400: "#27bfad",
          500: "#0ea394", 600: "#0b8479", 700: "#0d6962", 800: "#10544f", 900: "#124642", 950: "#042a28",
        },
        ink: { 900: "#0b1f2a", 800: "#12303d", 700: "#1d4252" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Plus Jakarta Sans'", "Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,.04), 0 4px 16px -4px rgba(15,23,42,.08)",
        lift: "0 10px 40px -12px rgba(13,105,98,.35)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: 0, transform: "translateY(12px)" }, "100%": { opacity: 1, transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      animation: { "fade-up": "fade-up .5s ease-out both", float: "float 6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
