import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, FileText } from 'lucide-react';
import { Badge, Card, CardContent } from '@/components/ui';
import { listSessions } from '@/features/advice/queries';

export const metadata: Metadata = { title: 'Beratungen' };
export const dynamic = 'force-dynamic';

const STATUS_LABEL = {
  DRAFT: 'Entwurf', IN_PROGRESS: 'Läuft', COMPLETED: 'Abgeschlossen', CANCELLED: 'Abgebrochen',
} as const;

export default async function SessionsPage() {
  const sessions = await listSessions();
  const running = sessions.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'DRAFT');
  const done = sessions.filter((s) => s.status === 'COMPLETED');

  function Row({ session }: { session: (typeof sessions)[number] }) {
    const open = session.status === 'IN_PROGRESS' || session.status === 'DRAFT';
    return (
      <li>
        <Link
          href={open ? `/beratung/${session.id}` : `/beratungen/${session.id}`}
          className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{session.customerName}</p>
            <p className="tabular text-[0.8125rem] text-ink-muted">
              {session.settled} von {session.total} Themen
              {session.startedAt
                ? ` · ${new Date(session.startedAt).toLocaleDateString('de-CH')}`
                : ''}
            </p>
          </div>
          <Badge tone={session.status === 'COMPLETED' ? 'success' : 'accent'}>
            {STATUS_LABEL[session.status]}
          </Badge>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-subtle" />
        </Link>
      </li>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-2xl">Beratungen</h1>
        <p className="text-sm text-ink-muted">
          Eine Beratung starten Sie beim Kunden.
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="grid gap-2 py-12 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
              <FileText aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <p className="font-medium">Noch keine Beratungen</p>
            <p className="mx-auto max-w-sm text-[0.8125rem] leading-relaxed text-ink-muted">
              Öffnen Sie einen Kunden und starten Sie dort eine Beratung.
            </p>
            <Link href="/kunden" className="mt-1 rounded-sm text-[0.8125rem] font-medium text-accent hover:underline">
              Zu den Kunden
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {running.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
            Laufend
          </h2>
          <Card><ul className="divide-y divide-line">
            {running.map((s) => <Row key={s.id} session={s} />)}
          </ul></Card>
        </section>
      ) : null}

      {done.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
            Abgeschlossen
          </h2>
          <Card><ul className="divide-y divide-line">
            {done.map((s) => <Row key={s.id} session={s} />)}
          </ul></Card>
        </section>
      ) : null}
    </div>
  );
}
