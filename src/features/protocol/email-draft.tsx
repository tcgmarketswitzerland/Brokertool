'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui';
import { buildEmailDraft } from '@/domain/advice/email';
import type { SummaryDocument } from '@/domain/advice/summary';

/**
 * Der Entwurf der Abschluss-E-Mail zum Kopieren.
 *
 * Bewusst kein Versand aus der Anwendung: der Berater schreibt aus seinem
 * eigenen Postfach, damit die Antwort des Kunden dort ankommt, wo er sie
 * sucht - und damit kein Mailserver eines Dritten Kundendaten sieht.
 */
export function EmailDraft({ document }: { document: SummaryDocument }) {
  const draft = buildEmailDraft(document);
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null);

  async function copy(what: 'subject' | 'body'): Promise<void> {
    try {
      await navigator.clipboard.writeText(what === 'subject' ? draft.subject : draft.body);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Ohne Zwischenablage-Recht bleibt der Text markierbar - deshalb hier
      // keine Fehlermeldung, die nichts besser macht.
    }
  }

  return (
    <div className="grid gap-3 px-5 py-4">
      <div className="grid gap-1.5">
        <span className="text-[0.8125rem] font-medium text-ink-muted">Betreff</span>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-md border border-line bg-surface-sunken px-3 py-2 text-[0.9375rem]">
            {draft.subject}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void copy('subject')}>
            {copied === 'subject' ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied === 'subject' ? 'Kopiert' : 'Kopieren'}
          </Button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="text-[0.8125rem] font-medium text-ink-muted">Text</span>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface-sunken px-3.5 py-3 font-sans text-[0.9375rem] leading-relaxed">
          {draft.body}
        </pre>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => void copy('body')}>
            {copied === 'body' ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied === 'body' ? 'Kopiert' : 'Text kopieren'}
          </Button>
        </div>
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-ink-subtle">
        Die abgelehnten Themen stehen bewusst nicht in der E-Mail. Sie sind im Protokoll
        dokumentiert — sie hier zu wiederholen liest sich wie Nachfassen.
      </p>
    </div>
  );
}
