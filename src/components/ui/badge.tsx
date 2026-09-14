import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-[0.25rem] px-1.5 py-0.5 text-[0.75rem] font-medium leading-5 [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-sunken text-ink-muted ring-1 ring-inset ring-line',
        accent: 'bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent-border',
        success: 'bg-success-soft text-success ring-1 ring-inset ring-success/25',
        warning: 'bg-warning-soft text-warning ring-1 ring-inset ring-warning/25',
        danger: 'bg-danger-soft text-danger ring-1 ring-inset ring-danger-border',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className, tone, ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
