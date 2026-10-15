import React, { useEffect, useRef, useState } from "react";

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


export function Input({ icon, className = "", type = "text", ...props }) {
  const isPassword = type === "password";
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
      )}

      <input
        {...props}
        type={isPassword && show ? "text" : type}
        className={`${FIELD} ${icon ? "pl-10" : ""} ${isPassword ? "pr-10" : ""} ${className}`}
      />

      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
        >
          {show ? (
            // Eye-off
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            // Eye
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
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
