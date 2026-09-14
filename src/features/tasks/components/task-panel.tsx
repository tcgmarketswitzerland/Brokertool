'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { TaskForm } from './task-form';
import { TaskRow } from './task-row';
import type { Task } from '../queries';

/**
 * Aufgabenliste mit Erfassung - beim Kunden und in der Beratungsansicht.
 */
export function TaskPanel({ tasks, today, customerId, showCustomer = false, emptyText }: {
  tasks: readonly Task[];
  today: string;
  customerId?: string | undefined;
  showCustomer?: boolean;
  emptyText: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="grid">
      {tasks.length > 0 ? (
        <ul className="divide-y divide-line border-b border-line">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} today={today} showCustomer={showCustomer} />
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-center text-[0.8125rem] text-ink-muted">{emptyText}</p>
      )}

      <div className="px-5 py-4">
        {adding ? (
          <div className="rounded-lg border border-line bg-surface-sunken p-4">
            <TaskForm customerId={customerId} onSaved={() => setAdding(false)} />
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />Aufgabe erfassen
          </Button>
        )}
      </div>
    </div>
  );
}
