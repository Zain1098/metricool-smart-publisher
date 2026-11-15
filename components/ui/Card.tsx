import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const PADDING_MAP = {
  none: '',
  sm: 'p-3.5',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export function Card({
  className,
  padding = 'md',
  interactive = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-studio-surface border border-studio-border shadow-studio',
        interactive &&
          'transition-colors duration-150 hover:border-studio-borderStrong hover:bg-[#171C26]',
        PADDING_MAP[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-studio-border',
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-ink-secondary flex-shrink-0">{icon}</span>}
          <h3 className="text-[13.5px] font-semibold text-ink-primary tracking-[-0.01em] truncate">
            {title}
          </h3>
        </div>
        {subtitle && (
          <p className="text-xs text-ink-muted leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
