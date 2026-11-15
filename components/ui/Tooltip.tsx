'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-flex group', className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-40 px-2 py-1 rounded-md bg-studio-shell border border-studio-borderStrong text-[11px] font-medium text-ink-primary whitespace-nowrap shadow-modal"
      >
        {label}
      </span>
    </span>
  );
}
