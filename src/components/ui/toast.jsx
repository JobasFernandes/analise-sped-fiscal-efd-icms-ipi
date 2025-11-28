import React, { useCallback, useMemo, useState, useRef } from "react";
import { ToastCtx } from "./use-toast";

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const remove = useCallback((id) => {
    if (timersRef.current[id]?.timerId) {
      clearTimeout(timersRef.current[id].timerId);
      delete timersRef.current[id];
    }
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const startTimer = useCallback(
    (id, duration) => {
      if (duration <= 0) return;
      const timerId = setTimeout(() => remove(id), duration);
      timersRef.current[id] = {
        timerId,
        remaining: duration,
        startTime: Date.now(),
      };
    },
    [remove]
  );

  const pauseTimer = useCallback((id) => {
    const timer = timersRef.current[id];
    if (timer?.timerId) {
      clearTimeout(timer.timerId);
      const elapsed = Date.now() - timer.startTime;
      timer.remaining = Math.max(timer.remaining - elapsed, 0);
      timer.timerId = null;
    }
  }, []);

  const resumeTimer = useCallback(
    (id) => {
      const timer = timersRef.current[id];
      if (timer && !timer.timerId && timer.remaining > 0) {
        timer.startTime = Date.now();
        timer.timerId = setTimeout(() => remove(id), timer.remaining);
      }
    },
    [remove]
  );

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
      startTimer(id, toast.duration);
      return id;
    },
    [startTimer]
  );

  const value = useMemo(() => ({ toast: push, dismiss: remove }), [push, remove]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed z-[60] right-4 bottom-4 space-y-2 w-[calc(100vw-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            onMouseEnter={() => pauseTimer(t.id)}
            onMouseLeave={() => resumeTimer(t.id)}
            className={`relative rounded-lg border p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-2 ${
              t.variant === "destructive"
                ? "border-red-500/50 bg-red-50 dark:bg-red-950/90 text-red-900 dark:text-red-100"
                : t.variant === "success"
                  ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100"
                  : "border-border bg-card dark:bg-card/95 text-card-foreground"
            }`}
          >
            {t.title && <div className="font-semibold text-sm pr-6">{t.title}</div>}
            {t.description && (
              <div
                className={`text-xs mt-1 ${
                  t.variant === "destructive"
                    ? "text-red-700 dark:text-red-300"
                    : t.variant === "success"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground"
                }`}
              >
                {t.description}
              </div>
            )}
            <button
              className={`absolute top-2 right-2 p-1 rounded-md text-lg leading-none hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
                t.variant === "destructive"
                  ? "text-red-600 dark:text-red-400"
                  : t.variant === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground"
              }`}
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
