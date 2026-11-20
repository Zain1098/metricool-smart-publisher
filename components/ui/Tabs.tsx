'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  size = 'sm',
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (val: T) => void;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 p-1 rounded-xl bg-surface-container border border-border overflow-x-auto max-w-full',
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all whitespace-nowrap',
              size === 'xs' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? 'bg-surface-lowest text-content-primary font-semibold shadow-card border border-border'
                : 'text-content-secondary hover:text-content-primary border border-transparent'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'font-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                  active
                    ? 'bg-brand-container text-brand'
                    : 'bg-surface-high text-content-secondary'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
