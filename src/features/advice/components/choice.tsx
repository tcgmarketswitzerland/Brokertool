'use client';

import { cn } from '@/lib/cn';

/**
 * Eine Auswahlflaeche im Gespraech.
 *
 * Gross genug, um sie mit einem Finger zu treffen, ohne hinzusehen - der
 * Berater schaut waehrenddessen den Kunden an, nicht das iPad.
 */
export function Choice({
  checked, onClick, children, color,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string | undefined;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-4 py-3 text-left text-[0.9375rem] font-medium transition-colors',
        checked
          ? 'border-transparent text-ink-inverted'
          : 'border-line bg-surface text-ink hover:bg-surface-hover',
      )}
      style={checked ? { backgroundColor: color ?? 'var(--color-accent)' } : undefined}
    >
      {children}
    </button>
  );
}
