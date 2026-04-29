/**
 * Trevor — Tailwind config
 *
 * The colour palette is bound to CSS custom properties defined in
 * `src/styles/globals.css` so that every utility (e.g. bg-trevor-bg)
 * automatically reflects the active theme. This keeps every existing
 * component working while enabling instant theme swaps.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        trevor: {
          bg: "var(--color-bg)",
          "bg-secondary": "var(--color-bg-secondary)",
          "bg-tertiary": "var(--color-bg-tertiary)",
          "bg-elevated": "var(--color-bg-elevated)",
          surface: "var(--color-bg-elevated)",
          "surface-hover": "var(--color-surface-hover)",
          border: "var(--color-border)",
          "border-subtle": "var(--color-border-subtle)",
          text: "var(--color-text)",
          "text-secondary": "var(--color-text-secondary)",
          "text-muted": "var(--color-text-muted)",
          accent: "var(--color-accent)",
          "accent-hover": "var(--color-accent-hover)",
          "accent-muted": "var(--color-accent)",
          danger: "var(--color-danger)",
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          info: "var(--color-info)",
        },
      },
      fontFamily: {
        sans: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
        editor: ["var(--font-editor)"],
      },
      fontSize: {
        "editor-body": ["var(--editor-font-size)", { lineHeight: "var(--editor-line-height)" }],
        "editor-h1": ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        "editor-h2": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "editor-h3": ["20px", { lineHeight: "1.4", fontWeight: "600" }],
      },
      width: {
        "notelist-w": "300px",
        "sidebar-w": "260px",
      },
      spacing: {
        "sidebar-w": "260px",
        "notelist-w": "300px",
      },
      boxShadow: {
        "elevation-1": "var(--shadow-elevation-1)",
        "elevation-2": "var(--shadow-elevation-2)",
      },
      animation: {
        "fade-in": "fadeIn 150ms ease-out",
        "slide-in": "slideIn 200ms ease-out",
        "scale-in": "scaleIn 160ms ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-thin": {
          "scrollbar-width": "thin",
          "scrollbar-color": "var(--color-border) transparent",
          "&::-webkit-scrollbar": { width: "6px", height: "6px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "var(--color-border)",
            "border-radius": "3px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "var(--color-text-muted)",
          },
        },
        ".scrollbar-auto": {
          "scrollbar-width": "thin",
          "scrollbar-color": "var(--color-border) transparent",
          "&::-webkit-scrollbar": { width: "8px", height: "8px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "var(--color-border)",
            "border-radius": "4px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "var(--color-text-muted)",
          },
        },
        ".line-clamp-1": {
          display: "-webkit-box",
          "-webkit-line-clamp": "1",
          "-webkit-box-orient": "vertical",
          overflow: "hidden",
        },
        ".line-clamp-2": {
          display: "-webkit-box",
          "-webkit-line-clamp": "2",
          "-webkit-box-orient": "vertical",
          overflow: "hidden",
        },
        ".line-clamp-3": {
          display: "-webkit-box",
          "-webkit-line-clamp": "3",
          "-webkit-box-orient": "vertical",
          overflow: "hidden",
        },
        ".editor-content": {
          "white-space": "pre-wrap",
          "word-wrap": "break-word",
        },
      });
    },
  ],
};
