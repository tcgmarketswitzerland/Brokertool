import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

const TONES = {
  info:    { cls: 'border-line bg-surface-sunken text-ink',                    Icon: Info },
  success: { cls: 'border-success/25 bg-success-soft text-success',            Icon: CheckCircle2 },
  warning: { cls: 'border-warning/25 bg-warning-soft text-warning',            Icon: AlertTriangle },
  danger:  { cls: 'border-danger-border bg-danger-soft text-danger',           Icon: XCircle },
} as const;

export function Alert({
  tone = 'info', title, children, className,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { cls, Icon } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-md border px-3.5 py-3 text-[0.8125rem]', cls, className)}
    >
      <Icon aria-hidden className="mt-px size-4 shrink-0" strokeWidth={2} />
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-medium">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
