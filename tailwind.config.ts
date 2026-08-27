import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // LevlCast design tokens — ported from levlcast.com
      colors: {
        bg: "#080c14",
        surface: "#0f1623",
        "surface-2": "#141d2e",
        accent: "#7C3AED",
        "accent-light": "#a78bfa",
        muted: "#8892a4",
        border: "rgba(255, 255, 255, 0.07)",
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "16px",
      },
      // Glow effect utilities
      boxShadow: {
        glow: "0 0 60px rgba(124, 58, 237, 0.15)",
        "glow-lg": "0 0 120px rgba(124, 58, 237, 0.25)",
      },
      // Smooth animations
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
