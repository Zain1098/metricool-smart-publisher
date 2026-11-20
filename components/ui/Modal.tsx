'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  badge,
  maxWidth = 'max-w-xl',
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  maxWidth?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'w-full rounded-2xl bg-surface-lowest border border-border shadow-elevated overflow-hidden flex flex-col max-h-[90vh]',
          maxWidth
        )}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 flex-shrink-0 bg-surface-low">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {badge}
              <h2 className="text-[15px] font-bold text-content-primary tracking-tight">
                {title}
              </h2>
            </div>
            {subtitle && (
              <p className="text-xs text-content-secondary font-medium">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-content-muted hover:text-content-primary hover:bg-surface-high transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 text-content-primary">{children}</div>

        {footer && (
          <div className="px-5 py-3.5 border-t border-border bg-surface-low flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
