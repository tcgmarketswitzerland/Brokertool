import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, FileText } from 'lucide-react';
import { Badge, Card, CardContent } from '@/components/ui';
import { listSessions, type SessionListItem } from '@/features/advice/queries';
import { formatDate } from '@/domain/shared/date';

export const metadata: Metadata = { title: 'Beratungen' };
export const dynamic = 'force-dynamic';

const STATUS_LABEL = {
  DRAFT: 'Angesetzt', IN_PROGRESS: 'Läuft', COMPLETED: 'Abgeschlossen', CANCELLED: 'Abgebrochen',
} as const;

const FILTERS = [
  { key: 'offen', label: 'Angesetzt' },
  { key: 'abgeschlossen', label: 'Abgeschlossen' },
  { key: 'alle', label: 'Alle' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function matches(session: SessionListItem, filter: FilterKey): boolean {
  if (filter === 'alle') return true;
  const open = session.status === 'DRAFT' || session.status === 'IN_PROGRESS';
  return filter === 'offen' ? open : session.status === 'COMPLETED';
}

function Row({ session }: { session: SessionListItem }) {
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
            {session.settled} von {session.total} Sparten
            {session.startedAt
              ? ` · ${formatDate(session.startedAt)}`
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

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ zeigen?: string }>;
}) {
  const { zeigen } = await searchParams;
  // Der Filter steht in der Adresse und nicht im Zustand einer Komponente:
  // so laesst sich eine gefilterte Liste verschicken und der Zurueck-Knopf
  // tut, was er soll.
  const filter: FilterKey =
    FILTERS.some((f) => f.key === zeigen) ? (zeigen as FilterKey) : 'offen';

  const sessions = await listSessions();
  const shown = sessions.filter((s) => matches(s, filter));

  const counts = {
    offen: sessions.filter((s) => matches(s, 'offen')).length,
    abgeschlossen: sessions.filter((s) => matches(s, 'abgeschlossen')).length,
    alle: sessions.length,
  } as const;

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-2xl">Beratungen</h1>
        <p className="text-sm text-ink-muted">
          Eine neue Beratung setzen Sie auf der Übersicht an.
        </p>
      </div>

      <nav aria-label="Filter" className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/beratungen?zeigen=${key}`}
            aria-current={filter === key ? 'page' : undefined}
            className={`tabular rounded-md border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
              filter === key
                ? 'border-accent-border bg-accent-soft text-accent-ink'
                : 'border-line bg-surface text-ink-muted hover:bg-surface-hover'
            }`}
          >
            {label}
            <span className="ml-1.5 font-normal opacity-70">{counts[key]}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="grid gap-2 py-12 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
              <FileText aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <p className="font-medium">
              {sessions.length === 0
                ? 'Noch keine Beratungen'
                : filter === 'offen'
                  ? 'Keine angesetzte Beratung'
                  : 'Keine abgeschlossene Beratung'}
            </p>
            <p className="mx-auto max-w-sm text-[0.8125rem] leading-relaxed text-ink-muted">
              Eine Beratung setzen Sie auf der Übersicht an — Kunde wählen oder neu erfassen.
            </p>
            <Link href="/dashboard"
                  className="mt-1 rounded-sm text-[0.8125rem] font-medium text-accent hover:underline">
              Zur Übersicht
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {shown.map((s) => <Row key={s.id} session={s} />)}
          </ul>
        </Card>
      )}
    </div>
  );
}
