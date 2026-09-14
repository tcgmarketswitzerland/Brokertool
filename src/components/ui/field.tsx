'use client';

import { useId } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/cn';

export function Label({
  className, ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-[0.8125rem] font-medium text-ink',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-describedby': string | undefined; 'aria-invalid': boolean }) => React.ReactNode;
};

/**
 * Verbindet Beschriftung, Hinweis und Fehlermeldung korrekt mit dem Feld.
 * Ohne diese Klammer wird aria-describedby erfahrungsgemaess irgendwann
 * vergessen - und Barrierefreiheit ist in Konzeptpunkt 34 gefordert.
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
      </Label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="text-[0.8125rem] text-danger">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-[0.8125rem] text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
