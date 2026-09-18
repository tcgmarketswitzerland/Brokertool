'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ImageIcon, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatDate } from '@/domain/shared/date';
import type { CustomerDocument } from './queries';

const MAX_BYTES = 20 * 1024 * 1024;

/** Ohne Intl, aus demselben Grund wie bei Betraegen und Daten. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / 104_857.6) / 10} MB`;
}

/**
 * Dokumente einer Sparte.
 *
 * Im Gespraech geoeffnet, nicht heruntergeladen: der Kunde sitzt daneben
 * und sieht auf dasselbe iPad. Die Datei kommt aus einem privaten Bucket
 * ueber eine signierte URL, die nach einer Minute verfaellt.
 */
export function DocumentShelf({
  customerId, sessionId, topicId, documents,
}: {
  customerId: string;
  sessionId?: string | undefined;
  topicId: string;
  documents: readonly CustomerDocument[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<void> {
    setError(null);

    // Die Groesse steht schon im Browser fest. Erst 20 MB zu uebertragen,
    // um dann eine Absage zu bekommen, waere im Mobilfunknetz aergerlich.
    if (file.size === 0 || file.size > MAX_BYTES) {
      setError('Die Datei ist leer oder grösser als 20 MB.');
      return;
    }

    const body = new FormData();
    body.set('file', file);
    body.set('customerId', customerId);
    body.set('topicId', topicId);
    if (sessionId) body.set('sessionId', sessionId);

    setBusy(true);
    try {
      const response = await fetch('/api/dokumente', { method: 'POST', body });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message = typeof payload === 'object' && payload !== null
          && typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : 'Der Upload ist fehlgeschlagen.';
        setError(message);
        return;
      }
      router.refresh();
    } catch {
      setError('Keine Verbindung — bitte erneut versuchen.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove(id: string): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/dokumente/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        setError('Das Dokument konnte nicht entfernt werden.');
        return;
      }
      router.refresh();
    } catch {
      setError('Keine Verbindung — bitte erneut versuchen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2.5">
      {documents.length > 0 ? (
        <ul className="grid gap-1.5">
          {documents.map((d) => {
            const Icon = d.mimeType === 'application/pdf' ? FileText : ImageIcon;
            return (
              <li key={d.id}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2">
                <a
                  href={`/api/dokumente/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm"
                >
                  <Icon aria-hidden className="size-4 shrink-0 text-ink-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.875rem] font-medium">
                      {d.filename}
                    </span>
                    <span className="tabular block text-[0.75rem] text-ink-subtle">
                      {formatDate(d.createdAt)} · {formatSize(d.sizeBytes)}
                    </span>
                  </span>
                </a>

                <Button
                  variant="ghost" size="icon" data-compact disabled={busy}
                  aria-label={`${d.filename} entfernen`}
                  onClick={() => { void remove(d.id); }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button variant="secondary" size="sm" loading={busy}
                onClick={() => inputRef.current?.click()}>
          <Paperclip aria-hidden />
          {documents.length > 0 ? 'Weiteres Dokument' : 'Police als PDF hinterlegen'}
        </Button>
        <span className="text-[0.75rem] text-ink-subtle">PDF, JPEG oder PNG, bis 20 MB</span>
      </div>

      {error ? (
        <p role="alert" className="text-[0.8125rem] text-danger">{error}</p>
      ) : null}
    </div>
  );
}
