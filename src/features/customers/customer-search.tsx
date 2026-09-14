'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui';

/**
 * Der Suchbegriff steht in der URL, nicht im Komponentenzustand: ein
 * versehentliches Neuladen im Gespraech landet damit an derselben Stelle,
 * und die Suche laesst sich verlinken.
 */
export function CustomerSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set('q', value.trim());
    else next.delete('q');
    startTransition(() => router.replace(`/kunden?${next.toString()}`));
  }

  return (
    <div className="relative max-w-sm">
      <Search aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
      <Input
        type="search"
        defaultValue={params.get('q') ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Name suchen"
        aria-label="Kunden suchen"
        aria-busy={pending}
        className="pl-8.5"
      />
    </div>
  );
}
