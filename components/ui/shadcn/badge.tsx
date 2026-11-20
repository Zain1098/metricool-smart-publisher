import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand text-brand-contrast',
        secondary: 'border-border bg-surface-container text-content-secondary',
        sage: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        peach: 'border-brand/25 bg-brand-container text-brand',
        rose: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
        lavender: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300',
        outline: 'border-border bg-surface-lowest text-content-secondary',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
