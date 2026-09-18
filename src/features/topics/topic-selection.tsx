'use client';

import { useActionState, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Alert, Badge, Button, TopicIcon } from '@/components/ui';
import { saveTopicSelection, type TopicActionState } from './actions';
import type { TopicChoice } from './queries';

const INITIAL: TopicActionState = { status: 'idle' };

/**
 * Welche Sparten die Beratung abdeckt.
 *
 * Pfeile statt Ziehen und Ablegen: die Seite wird auch auf dem iPad
 * bedient, und Drag-and-Drop ist dort mit einem Finger unzuverlaessig -
 * besonders in einer langen Liste, die dabei scrollen muss.
 */
export function TopicSelection({ topics }: { topics: readonly TopicChoice[] }) {
  const [state, action, pending] = useActionState(saveTopicSelection, INITIAL);
  const [rows, setRows] = useState<TopicChoice[]>([...topics]);

  function move(index: number, delta: number) {
    setRows((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const a = next[index];
      const b = next[target];
      if (!a || !b) return current;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }

  function toggle(id: string, field: 'isEnabled' | 'isRequired') {
    setRows((current) => current.map((t) => {
      if (t.id !== id) return t;
      const value = !t[field];
      // Eine abgewaehlte Sparte kann keine Pflicht sein - sonst waere die
      // Beratung nie abschliessbar.
      if (field === 'isEnabled' && !value) return { ...t, isEnabled: false, isRequired: false };
      if (field === 'isRequired' && value) return { ...t, isEnabled: true, isRequired: true };
      return { ...t, [field]: value };
    }));
  }

  const active = rows.filter((t) => t.isEnabled).length;
  const required = rows.filter((t) => t.isRequired).length;

  const payload = JSON.stringify(rows.map((t) => ({
    topic_id: t.id,
    is_enabled: t.isEnabled,
    is_required: t.isRequired,
  })));

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="auswahl" value={payload} />

      <ul className="grid gap-1.5">
        {rows.map((topic, index) => (
          <li
            key={topic.id}
            className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              topic.isEnabled ? 'border-line bg-surface' : 'border-dashed border-line bg-surface-sunken'
            }`}
          >
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken ${
              topic.isEnabled ? 'text-ink-muted' : 'text-ink-subtle'
            }`}>
              <TopicIcon name={topic.icon} className="size-4" />
            </span>

            <span className={`min-w-0 flex-1 truncate font-medium ${
              topic.isEnabled ? '' : 'text-ink-subtle'
            }`}>
              {topic.name}
              {topic.isRequired ? <Badge className="ml-2">Pflicht</Badge> : null}
            </span>

            <label className="flex items-center gap-1.5 text-[0.8125rem]">
              <input type="checkbox" checked={topic.isEnabled}
                     onChange={() => toggle(topic.id, 'isEnabled')}
                     className="size-4 accent-[var(--color-accent)]"
                     aria-label={`${topic.name} in der Beratung zeigen`} />
              Aktiv
            </label>

            <label className="flex items-center gap-1.5 text-[0.8125rem]">
              <input type="checkbox" checked={topic.isRequired}
                     onChange={() => toggle(topic.id, 'isRequired')}
                     className="size-4 accent-[var(--color-accent)]"
                     aria-label={`${topic.name} als Pflichtthema`} />
              Pflicht
            </label>

            <span className="flex gap-0.5">
              <Button type="button" variant="ghost" size="icon" data-compact
                      disabled={index === 0} onClick={() => move(index, -1)}
                      aria-label={`${topic.name} nach oben`}>
                <ArrowUp aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" data-compact
                      disabled={index === rows.length - 1} onClick={() => move(index, 1)}
                      aria-label={`${topic.name} nach unten`}>
                <ArrowDown aria-hidden />
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <p className="tabular text-[0.8125rem] text-ink-muted">
        {active} von {rows.length} Sparten aktiv, davon {required}{' '}
        {required === 1 ? 'Pflichtthema' : 'Pflichtthemen'}.
      </p>

      {active === 0 ? (
        <Alert tone="danger">Mindestens eine Sparte muss aktiv bleiben.</Alert>
      ) : null}
      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={active === 0}>Speichern</Button>
        {state.status === 'ok' ? (
          <span className="text-[0.8125rem] text-success">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
