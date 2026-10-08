/** @type {import('tailwindcss').Config} */

// Semantic colours are driven by CSS variables (defined in src/index.css) so a
// single token like `text-primary` resolves to a readable colour in BOTH light
// and dark mode. The raw palette below is the fixed brand set:
//
//   #ffffff  paper      cards and light surfaces
//   #676f9d  haze       muted text, secondary indigo
//   #424769  ink        primary in light mode, raised surfaces in dark
//   #2d3250  night      headings, app background in dark mode
//   #f9b17a  highlight  study progress, streaks, focus — the one loud colour
const withVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // The neutral ramp is tinted toward the brand navy, so every existing
        // `slate-*` class in the app lands on-palette without being rewritten.
        slate: {
          50: "#f7f8fc",
          100: "#eef0f8",
          200: "#e0e3f0",
          300: "#c5cadf",
          400: "#8a92bd",
          500: "#676f9d",
          600: "#545c86",
          700: "#424769",
          800: "#363b5c",
          900: "#2d3250",
          950: "#23273f",
        },
        red: {
          400: "#ff9b8f",
          500: "#e05c4b",
          600: "#c94433",
        },
        paper: "#ffffff",
        haze: "#676f9d",
        ink: "#424769",
        night: "#2d3250",
        highlight: {
          DEFAULT: "#f9b17a",
          soft: "#fcd9bd",
          deep: "#e08f51",
        },

        primary: {
          DEFAULT: withVar("--c-primary"),
          dark: withVar("--c-primary-dark"),
          fg: withVar("--c-primary-fg"),
          soft: withVar("--c-primary-soft"),
        },
        accent: {
          DEFAULT: "#f9b17a",
          fg: "#2d3250",
        },
        navy: "#2d3250",
        secondary: {
          purple: withVar("--c-secondary"),
          blue: withVar("--c-primary"),
        },
        success: withVar("--c-success"),
        warning: withVar("--c-warning"),
        danger: withVar("--c-danger"),

        surface: withVar("--c-surface"),
        "surface-raised": withVar("--c-surface-raised"),
        hairline: withVar("--c-hairline"),
      },
      borderRadius: {
        lg: "10px",
        xl: "14px",
        "2xl": "18px",
        "3xl": "26px",
      },
      boxShadow: {
        // Navy-tinted rather than neutral grey, so elevation stays on-palette.
        card: "0 1px 2px rgb(45 50 80 / 0.06), 0 8px 24px -12px rgb(45 50 80 / 0.18)",
        lift: "0 2px 4px rgb(45 50 80 / 0.08), 0 18px 40px -18px rgb(45 50 80 / 0.32)",
        glow: "0 10px 30px -12px rgb(249 177 122 / 0.65)",
      },
      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(110%)" },
          to: { transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "ember": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.08)", opacity: "0.86" },
        },
      },
      animation: {
        "rise-in": "rise-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-up": "slide-up 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.6s infinite",
        ember: "ember 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
