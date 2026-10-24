import React, { useEffect } from "react";
import { X } from "lucide-react";

// Accessible dialog. On phones it is a bottom sheet (grab handle, safe-area
// padding, slides up); from `sm` up it is a centred card. Esc and backdrop
// click close it.
export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-night/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        className={`max-h-[88vh] w-full animate-slide-up overflow-y-auto rounded-t-3xl border border-slate-200 bg-white px-4 pt-2 shadow-lift dark:border-slate-800 dark:bg-slate-900 sm:animate-rise-in sm:rounded-2xl sm:p-5 ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
