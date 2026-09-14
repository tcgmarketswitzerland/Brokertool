import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Natives select statt eines nachgebauten Menues: auf dem iPad oeffnet das
 * System seinen eigenen Auswahldialog, der mit einer Hand bedienbar ist und
 * jede Nachbildung schlaegt.
 */
export function Select({
  className, children, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-line-strong bg-surface',
          'pl-3 pr-8 text-sm text-ink transition-[border-color,box-shadow]',
          'focus-visible:border-accent focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]/25',
          'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
          'max-sm:text-base',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
      />
    </div>
  );
}
