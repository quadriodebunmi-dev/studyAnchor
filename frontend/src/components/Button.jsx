import React from "react";

// `primary` resolves through the --c-primary variables: deep navy on light
// backgrounds, peach on dark ones, so it stays readable in both themes.
const VARIANTS = {
  primary: "bg-primary text-primary-fg hover:bg-primary-dark shadow-card",
  accent: "bg-accent text-accent-fg hover:bg-highlight-deep shadow-glow",
  secondary: "bg-secondary-purple text-white hover:opacity-90 dark:text-night",
  ghost: "text-night dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
  destructive: "bg-danger text-white dark:text-night hover:opacity-90",
  outline:
    "border border-slate-300 dark:border-slate-700 text-night dark:text-slate-200 hover:border-accent hover:bg-slate-50 dark:hover:bg-slate-800",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-5 py-3 text-base gap-2",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-xl font-medium
        transition-[background-color,border-color,transform,box-shadow] duration-150
        active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50
        ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
