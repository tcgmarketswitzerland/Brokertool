'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

const OPTIONS: ReadonlyArray<{ value: Theme; icon: typeof Sun; label: string }> = [
  { value: 'light', icon: Sun, label: 'Hell' },
  { value: 'dark', icon: Moon, label: 'Dunkel' },
  { value: 'system', icon: Monitor, label: 'System' },
];

/**
 * localStorage ist ein externer Speicher, kein React-Zustand - deshalb
 * useSyncExternalStore statt useState mit Effekt. Das vermeidet zugleich
 * den Hydrationskonflikt: serverseitig gilt 'system', der Client korrigiert
 * beim ersten Abgleich, und das eingebettete Skript im Layout hat das
 * Attribut ohnehin schon vor dem ersten Anstrich gesetzt.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    // Privates Fenster oder blockierter Speicher: Systemeinstellung gilt.
    return 'system';
  }
}

const getServerSnapshot = (): Theme => 'system';

function setTheme(next: Theme): void {
  const root = document.documentElement;
  if (next === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', next);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Nicht kritisch: die Wahl gilt dann nur fuer diese Sitzung.
  }
  for (const notify of listeners) notify();
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="radiogroup"
      aria-label="Farbschema"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            data-compact
            onClick={() => setTheme(value)}
            className={cn(
              'flex size-7 items-center justify-center rounded-[0.25rem] transition-colors',
              active ? 'bg-surface text-ink' : 'text-ink-subtle hover:text-ink',
            )}
          >
            <Icon aria-hidden className="size-3.5" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
