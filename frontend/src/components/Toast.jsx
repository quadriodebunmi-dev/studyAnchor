import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text, type = "info") => {
    setToast({ text, type, id: Date.now() });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // Toasts sit on the deep navy in every theme so they read as system voice
  // rather than as another card on the page.
  const accents = {
    success: "text-success",
    error: "text-danger",
    info: "text-accent",
  };
  const Icon = { success: CheckCircle2, error: XCircle, info: Info }[toast?.type] || Info;

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-[100] animate-slide-up sm:inset-x-auto sm:bottom-6 sm:right-6 lg:bottom-6"
        >
          <div className="flex items-center gap-2.5 rounded-xl bg-night px-4 py-3 text-sm font-medium text-white shadow-lift ring-1 ring-white/10">
            <Icon className={`h-4 w-4 shrink-0 ${accents[toast.type] || accents.info}`} />
            {toast.text}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
