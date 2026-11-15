'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-16 lg:bottom-5 right-4 z-[60] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto rounded-xl bg-studio-surface border px-3.5 py-3 shadow-modal flex items-start gap-2.5',
              t.type === 'success'
                ? 'border-status-success/40'
                : t.type === 'error'
                ? 'border-status-danger/40'
                : t.type === 'warning'
                ? 'border-status-warning/40'
                : 'border-studio-borderStrong'
            )}
          >
            <span className="mt-0.5 flex-shrink-0">
              {t.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-status-success" />
              ) : t.type === 'error' || t.type === 'warning' ? (
                <AlertTriangle
                  className={cn(
                    'w-4 h-4',
                    t.type === 'error' ? 'text-status-danger' : 'text-status-warning'
                  )}
                />
              ) : (
                <Info className="w-4 h-4 text-status-cloud" />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-xs font-semibold text-ink-primary">{t.title}</p>
              {t.description && (
                <p className="text-[11px] text-ink-secondary leading-snug">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-ink-muted hover:text-ink-primary p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
