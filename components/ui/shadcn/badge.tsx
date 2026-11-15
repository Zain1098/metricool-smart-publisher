import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#C27345] text-white',
        secondary: 'border-[#E7DFD5] bg-[#F5EFE8] text-[#4E463F]',
        sage: 'border-[#C5DDD0] bg-[#DCEAE2] text-[#24503B]',
        peach: 'border-[#EACBB4] bg-[#F5DFCE] text-[#8D451E]',
        rose: 'border-[#E8C5CD] bg-[#F3DADF] text-[#8B3247]',
        lavender: 'border-[#D4CBEB] bg-[#E5DFF5] text-[#4B3688]',
        outline: 'border-[#E2D9CE] bg-white text-[#4E463F]',
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
