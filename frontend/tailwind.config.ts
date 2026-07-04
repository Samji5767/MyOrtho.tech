import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        medical: {
          teal: "#0d9488",
          blue: "#0284c7",
          glow: "rgba(13, 148, 136, 0.15)",
        },
        // Download Center design tokens
        dl: {
          bg: "var(--dl-bg)",
          surface: "var(--dl-surface)",
          border: "var(--dl-border)",
          text: "var(--dl-text)",
          muted: "var(--dl-muted)",
          accent: "var(--dl-accent)",
          "accent-hover": "var(--dl-accent-hover)",
          "accent-glow": "var(--dl-accent-glow)",
        },
      },
      fontFamily: {
        dl: ["var(--dl-font)", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 15px var(--primary-glow)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
