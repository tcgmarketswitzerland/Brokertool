import { cn } from '@/lib/cn';

export function Input({
  className, type = 'text', ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-line-strong bg-surface px-3 py-1',
        'text-sm text-ink transition-[border-color,box-shadow]',
        'placeholder:text-ink-subtle',
        'hover:border-line-strong/80',
        'focus-visible:border-accent focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]/25',
        'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20',
        // 16px verhindert, dass iPadOS und iOS beim Fokus hineinzoomen
        'max-sm:text-base',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-20 w-full rounded-md border border-line-strong bg-surface px-3 py-2',
        'text-sm leading-relaxed text-ink transition-[border-color,box-shadow]',
        'placeholder:text-ink-subtle field-sizing-content',
        'focus-visible:border-accent focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]/25',
        'max-sm:text-base',
        className,
      )}
      {...props}
    />
  );
}
