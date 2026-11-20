import React from 'react';
import { cn } from '@/lib/utils';

export function FieldLabel({
  htmlFor,
  children,
  hint,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2 mb-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-content-primary"
      >
        {children}
      </label>
      {hint && <span className="text-[11px] text-content-muted font-mono">{hint}</span>}
    </div>
  );
}

const BASE_INPUT_CLASSES =
  'w-full rounded-xl bg-surface-lowest border border-border text-[13px] text-content-primary placeholder:text-content-muted transition-all focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-50 shadow-card';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { leftIcon?: React.ReactNode }
>(({ className, leftIcon, ...props }, ref) => {
  if (leftIcon) {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
          {leftIcon}
        </span>
        <input
          ref={ref}
          className={cn(BASE_INPUT_CLASSES, 'h-9 pl-9 pr-3', className)}
          {...props}
        />
      </div>
    );
  }
  return (
    <input
      ref={ref}
      className={cn(BASE_INPUT_CLASSES, 'h-9 px-3', className)}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(BASE_INPUT_CLASSES, 'p-3 resize-y leading-relaxed', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(BASE_INPUT_CLASSES, 'h-9 px-3', className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
