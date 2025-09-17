import React, { useCallback, useMemo, useState } from "react";
import { ToastCtx } from "./use-toast";

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (opts) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const toast = {
        id,
        title: opts?.title || "",
        description: opts?.description || "",
        variant: opts?.variant || "default",
        duration: opts?.duration ?? 4000,
      };
      setToasts((t) => [...t, toast]);
      if (toast.duration > 0) {
        setTimeout(() => remove(id), toast.duration);
      }
      return id;
    },
    [remove]
  );

  const value = useMemo(() => ({ toast: push, dismiss: remove }), [push, remove]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed z-[60] right-4 bottom-4 space-y-2 w-[calc(100vw-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md border p-3 shadow-md bg-card text-card-foreground ${
              t.variant === "destructive"
                ? "border-red-600 bg-red-600/10"
                : t.variant === "success"
                  ? "border-emerald-600 bg-emerald-600/10"
                  : "border-border"
            }`}
          >
            {t.title && <div className="font-medium text-sm">{t.title}</div>}
            {t.description && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {t.description}
              </div>
            )}
            <button
              className="absolute top-1.5 right-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => remove(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export default React.memo(ToastProvider);
