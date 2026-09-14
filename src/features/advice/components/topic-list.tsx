'use client';

import { Check, ChevronRight, CircleDashed, CircleDot, Clock, Minus, Slash, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { DISPLAY_STATE_META, toDisplayState } from '@/domain/advice/topic-status';
import type { TopicState } from '@/domain/advice/session-state';

const ICONS = {
  check: Check, alert: TriangleAlert, slash: Slash, clock: Clock,
  minus: Minus, 'circle-dot': CircleDot, 'circle-dashed': CircleDashed,
} as const;

/**
 * Gleichwertige Alternative zum Rad (Analyse 1.7).
 *
 * Das Rad ist die Uebersicht und das Praesentationselement; gearbeitet wird
 * meist hier, weil eine Liste grosse Trefferflaechen hat, beliebig lang
 * werden kann und sich mit dem Daumen scrollen laesst.
 */
export function TopicList({
  topics, names, activeId, onSelect,
}: {
  topics: readonly TopicState[];
  names: Readonly<Record<string, string>>;
  activeId?: string | undefined;
  onSelect: (topicId: string) => void;
}) {
  return (
    <ul className="grid gap-1.5">
      {topics.map((topic) => {
        const display = toDisplayState(topic.progressStatus, topic.outcome);
        const meta = DISPLAY_STATE_META[display];
        const Icon = ICONS[meta.icon as keyof typeof ICONS] ?? CircleDashed;
        const active = topic.topicId === activeId;

        return (
          <li key={topic.topicId}>
            <button
              type="button"
              onClick={() => onSelect(topic.topicId)}
              aria-current={active || undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                active
                  ? 'border-accent-border bg-accent-soft'
                  : 'border-line bg-surface hover:bg-surface-hover',
              )}
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: meta.color, color: 'var(--color-surface)' }}
              >
                <Icon aria-hidden className="size-4" strokeWidth={2.5} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {names[topic.topicId] ?? topic.topicId}
                  {topic.isRequired ? (
                    <span className="ml-1.5 text-[0.75rem] font-normal text-ink-subtle">Pflicht</span>
                  ) : null}
                </span>
                <span className="block truncate text-[0.8125rem] text-ink-muted">{meta.label}</span>
              </span>

              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-subtle" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
