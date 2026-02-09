import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "ink": "#0f172a",
        "soft": "#f8fafc",
        "accent": "#6366f1",
        "accent-dark": "#4f46e5"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
