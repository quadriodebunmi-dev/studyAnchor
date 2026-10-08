import React from "react";

const FIELD = `w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm
  text-night outline-none transition-colors
  placeholder-slate-400 hover:border-slate-400
  focus:border-accent focus:ring-2 focus:ring-accent/40
  dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100
  dark:placeholder-slate-500 dark:hover:border-slate-600`;

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-night dark:text-slate-200">{label}</span>
      )}
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs lv-meta">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ icon, className = "", ...props }) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
      )}
      <input {...props} className={`${FIELD} ${icon ? "pl-10" : ""} ${className}`} />
    </div>
  );
}

export function Select({ icon, children, className = "", ...props }) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
      )}
      <select {...props} className={`${FIELD} cursor-pointer ${icon ? "pl-10" : ""} ${className}`}>
        {children}
      </select>
    </div>
  );
}

export function Textarea({ className = "", ...props }) {
  return <textarea {...props} className={`${FIELD} min-h-24 resize-y ${className}`} />;
}
