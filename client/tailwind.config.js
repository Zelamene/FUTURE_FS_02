/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  theme: {
    extend: {
      // COLOURS

      colors: {
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        subtle: "var(--bg-subtle)",
        muted: "var(--bg-muted)",

        border: {
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
        },

        content: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },

        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          subtle: "var(--accent-subtle-bg)",
        },

        success: {
          DEFAULT: "var(--success)",
          subtle: "var(--success-subtle-bg)",
        },

        warning: {
          DEFAULT: "var(--warning)",
          subtle: "var(--warning-subtle-bg)",
        },

        danger: {
          DEFAULT: "var(--danger)",
          subtle: "var(--danger-subtle-bg)",
        },

        neutral: {
          subtle: "var(--neutral-subtle-bg)",
        },
      },

      // TYPOGRAPHY

      fontFamily: {
        sans: ["Geist", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SF Mono", "monospace"],
      },

      fontSize: {
        "2xs": ["11px", { lineHeight: "16px", letterSpacing: "0.05em" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "20px" }],
        md: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["22px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        "2xl": ["28px", { lineHeight: "36px", letterSpacing: "-0.01em" }],
      },

      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
      },

      // SPACING

      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        12: "48px",
        16: "64px",
      },

      // RADIUS

      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        full: "9999px",
      },

      // ELEVATION

      boxShadow: {
        none: "none",
        sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
        md: "0 4px 12px rgba(0, 0, 0, 0.08)",
        lg: "0 8px 24px rgba(0, 0, 0, 0.12)",
      },

      // MOTION

      transitionDuration: {
        fast: "100ms",
        base: "150ms",
        slow: "250ms",
      },

      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      // LAYOUT

      maxWidth: {
        prose: "70ch",
        content: "1200px",
        modal: "480px",
      },

      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
  },

  plugins: [],
};
