'use client';

import { AlertTriangle, Check, CloudOff, RefreshCw } from 'lucide-react';
import type { SyncStatus } from '@/lib/sync/sync-engine';
import { cn } from '@/lib/cn';

/**
 * Der Berater muss jederzeit sehen, ob seine Eingaben angekommen sind.
 * Ein stiller Ausgangskorb waere schlimmer als gar keiner: er wiegt in
 * Sicherheit, bis am Ende des Gespraechs etwas fehlt.
 */
export function SyncIndicator({ status, className }: { status: SyncStatus; className?: string }) {
  const view = {
    idle: { Icon: Check, text: 'Gesichert', tone: 'text-ink-subtle' },
    syncing: { Icon: RefreshCw, text: 'Wird übertragen', tone: 'text-ink-muted' },
    offline: { Icon: CloudOff, text: 'Offline — lokal gesichert', tone: 'text-warning' },
    error: { Icon: CloudOff, text: 'Keine Verbindung', tone: 'text-warning' },
    conflict: { Icon: AlertTriangle, text: 'Konflikt', tone: 'text-danger' },
  }[status.kind];

  const count = 'pending' in status ? status.pending : 0;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-1.5 text-[0.8125rem]', view.tone, className)}
    >
      <view.Icon
        aria-hidden
        className={cn('size-3.5', status.kind === 'syncing' && 'animate-spin')}
        strokeWidth={2}
      />
      <span>
        {view.text}
        {count > 0 && status.kind !== 'idle' ? ` · ${count}` : ''}
      </span>
    </span>
  );
}
