import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        surface: "#111111",
        "surface-2": "#1A1A1A",
        "surface-3": "#222222",
        accent: "#A855F7",
        "accent-light": "#C084FC",
        "accent-dark": "#7C3AED",
        neon: "#22FF88",
        "neon-dim": "rgba(34, 255, 136, 0.15)",
        cyan: "#67E8F9",
        "cyan-dim": "rgba(103, 232, 249, 0.15)",
        muted: "#9CA3AF",
        border: "rgba(255, 255, 255, 0.08)",
        "border-accent": "rgba(168, 85, 247, 0.25)",
      },
      fontFamily: {
        sans: ["var(--font-geist)", "DM Sans", "system-ui", "sans-serif"],
        geist: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        glow: "0 0 40px rgba(168, 85, 247, 0.2)",
        "glow-lg": "0 0 80px rgba(168, 85, 247, 0.3)",
        "glow-neon": "0 0 30px rgba(34, 255, 136, 0.25)",
        "glow-cyan": "0 0 30px rgba(103, 232, 249, 0.2)",
        card: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(168, 85, 247, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(168, 85, 247, 0.6)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
