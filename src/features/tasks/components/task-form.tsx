'use client';

import { useActionState, useRef } from 'react';
import { Alert, Button, Input, Select, Textarea } from '@/components/ui';
import { TASK_OWNERS, TASK_OWNER_LABEL, TASK_PRIORITIES, TASK_PRIORITY_LABEL } from '@/domain/task/types';
import { createTask } from '../actions';
import type { TaskActionState } from '../schemas';

const INITIAL: TaskActionState = { status: 'idle' };

/**
 * Aufgabe von Hand erfassen.
 *
 * Der Normalfall ist, dass Aufgaben beim Abschluss der Beratung aus den
 * Ergebnissen entstehen. Dieses Formular ist fuer alles, was daneben
 * anfaellt - ein Anruf, eine Unterlage, eine Zusage.
 */
export function TaskForm({ customerId, onSaved }: {
  customerId?: string | undefined;
  onSaved?: (() => void) | undefined;
}) {
  const [state, action, pending] = useActionState(createTask, INITIAL);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      action={async (data) => {
        await action(data);
        form.current?.reset();
        onSaved?.();
      }}
      className="grid gap-3"
    >
      {customerId ? <input type="hidden" name="customerId" value={customerId} /> : null}

      <div className="grid gap-1.5">
        <label htmlFor="task-title" className="text-[0.8125rem] font-medium">Aufgabe</label>
        <Input id="task-title" name="title" required maxLength={300}
               placeholder="Offerte Hausrat bei Kunde nachfassen" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor="task-owner" className="text-[0.8125rem] font-medium">Wer</label>
          <Select id="task-owner" name="ownerType" defaultValue="ADVISOR">
            {TASK_OWNERS.map((o) => (
              <option key={o} value={o}>{TASK_OWNER_LABEL[o]}</option>
            ))}
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="task-priority" className="text-[0.8125rem] font-medium">Priorität</label>
          <Select id="task-priority" name="priority" defaultValue="NORMAL">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>
            ))}
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="task-due" className="text-[0.8125rem] font-medium">Fällig bis</label>
          <Input id="task-due" name="dueDate" type="date" />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="task-note" className="text-[0.8125rem] font-medium">
          Notiz <span className="font-normal text-ink-subtle">— optional</span>
        </label>
        <Textarea id="task-note" name="description" rows={2} maxLength={2000} />
      </div>

      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="flex justify-end gap-2">
        {onSaved ? (
          <Button type="button" variant="ghost" onClick={onSaved}>Abbrechen</Button>
        ) : null}
        <Button type="submit" loading={pending}>Aufgabe erstellen</Button>
      </div>
    </form>
  );
}
