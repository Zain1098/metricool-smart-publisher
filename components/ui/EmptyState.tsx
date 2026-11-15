import React from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-studio-border bg-studio-shell/60 px-6 py-10 text-center flex flex-col items-center justify-center gap-3',
        className
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-studio-subtle border border-studio-border flex items-center justify-center text-ink-secondary">
        {icon}
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-[13.5px] font-semibold text-ink-primary">{title}</h3>
        <p className="text-xs text-ink-muted leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
