import { cn } from '@/lib/cn';

/**
 * Wortmarke mit einem Ringzeichen, das das Beratungsrad aufgreift: ein
 * geschlossener Kreis aus Segmenten, von denen eines hervorgehoben ist -
 * die Sparte, die gerade besprochen wird.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-[22px] shrink-0" fill="none">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity="0.28" strokeWidth="3" />
        <path
          d="M12 3.5a8.5 8.5 0 0 1 7.36 4.25"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
      {showWordmark ? (
        <span className="text-[0.9375rem] font-semibold tracking-[-0.02em]">Brokertool</span>
      ) : null}
    </span>
  );
}
