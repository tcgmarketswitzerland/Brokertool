'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Check, RotateCcw, User, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui';
import {
  TASK_PRIORITY_LABEL, isOpen, isOverdue,
  type TaskPriority, type TaskStatus,
} from '@/domain/task/types';
import { setTaskStatus } from '../actions';
import type { TaskActionState } from '../schemas';
import type { Task } from '../queries';
import { formatDate } from '@/domain/shared/date';

const INITIAL: TaskActionState = { status: 'idle' };

function StatusButton({ taskId, next, label, icon: Icon }: {
  taskId: string;
  next: TaskStatus;
  label: string;
  icon: typeof Check;
}) {
  const [state, action, pending] = useActionState(setTaskStatus, INITIAL);

  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={pending}
        title={label}
        aria-label={label}
        className="flex size-8 items-center justify-center rounded-md border border-line text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
      >
        <Icon aria-hidden className="size-4" />
      </button>
      {state.status === 'error' ? (
        <span role="alert" className="sr-only">{state.message}</span>
      ) : null}
    </form>
  );
}

const PRIORITY_TONE: Record<TaskPriority, 'danger' | 'neutral'> = {
  HIGH: 'danger', NORMAL: 'neutral', LOW: 'neutral',
};

/**
 * Eine Aufgabe in der Liste.
 *
 * Links steht, wer dran ist - das ist die Frage, die der Berater morgens
 * an die Liste stellt. Erledigen ist ein Klick, nicht ein Formular:
 * Aufgaben, deren Abhaken Arbeit macht, werden nicht abgehakt.
 */
export function TaskRow({ task, today, showCustomer = true }: {
  task: Task;
  today: string;
  showCustomer?: boolean;
}) {
  const open = isOpen(task.status);
  const overdue = isOverdue(task.status, task.dueDate, today);
  const Owner = task.ownerType === 'CUSTOMER' ? UserRound : User;

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span
        title={task.ownerType === 'CUSTOMER' ? 'Aufgabe des Kunden' : 'Ihre Aufgabe'}
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${
          task.ownerType === 'CUSTOMER'
            ? 'bg-surface-sunken text-ink-muted'
            : 'bg-accent-soft text-accent-ink'
        }`}
      >
        <Owner aria-hidden className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-[0.9375rem] ${open ? 'font-medium' : 'text-ink-muted line-through'}`}>
          {task.title}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-muted">
          {showCustomer && task.customerName ? (
            task.customerId ? (
              <Link href={`/kunden/${task.customerId}`} className="rounded-sm hover:underline">
                {task.customerName}
              </Link>
            ) : <span>{task.customerName}</span>
          ) : null}
          {task.ownerType === 'ADVISOR' && task.assigneeName ? (
            <span>{task.assigneeName}</span>
          ) : null}
          {task.dueDate ? (
            <span className={`tabular ${overdue ? 'font-medium text-danger' : ''}`}>
              {overdue ? 'überfällig seit ' : 'bis '}
              {formatDate(task.dueDate)}
            </span>
          ) : null}
        </p>
        {task.description ? (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-subtle">
            {task.description}
          </p>
        ) : null}
      </div>

      {task.priority !== 'NORMAL' && open ? (
        <Badge tone={PRIORITY_TONE[task.priority]}>{TASK_PRIORITY_LABEL[task.priority]}</Badge>
      ) : null}

      {open ? (
        <StatusButton taskId={task.id} next="DONE" label="Erledigt" icon={Check} />
      ) : (
        <StatusButton taskId={task.id} next="OPEN" label="Wieder öffnen" icon={RotateCcw} />
      )}
    </li>
  );
}
