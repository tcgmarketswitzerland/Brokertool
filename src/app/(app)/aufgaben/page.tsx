import type { Metadata } from 'next';
import { CheckCircle2, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { isOpen, isOverdue } from '@/domain/task/types';
import { listTasks } from '@/features/tasks/queries';
import { TaskPanel } from '@/features/tasks/components/task-panel';
import { TaskRow } from '@/features/tasks/components/task-row';

export const metadata: Metadata = { title: 'Aufgaben' };
export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const tasks = await listTasks();
  // Serverseitig bestimmt: im Browser berechnet waere es beim ersten
  // Rendern eine andere Zeitzone als hier - und damit ein Hydration-Fehler.
  const today = new Date().toISOString().slice(0, 10);

  const open = tasks.filter((t) => isOpen(t.status));
  const overdue = open.filter((t) => isOverdue(t.status, t.dueDate, today));
  const done = tasks.filter((t) => !isOpen(t.status));

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-2xl">Aufgaben</h1>
        <p className="text-sm text-ink-muted">
          {open.length === 0
            ? 'Nichts offen.'
            : `${open.length} offen${overdue.length > 0 ? ` · ${overdue.length} überfällig` : ''}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo aria-hidden className="size-4 text-ink-subtle" />
            Offen
          </CardTitle>
        </CardHeader>
        <TaskPanel
          tasks={open}
          today={today}
          showCustomer
          emptyText="Keine offenen Aufgaben. Aufgaben entstehen beim Abschluss einer Beratung."
        />
      </Card>

      {done.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 aria-hidden className="size-4 text-success" />
              Erledigt
            </CardTitle>
          </CardHeader>
          <ul className="divide-y divide-line">
            {done.slice(0, 30).map((t) => (
              <TaskRow key={t.id} task={t} today={today} />
            ))}
          </ul>
          {done.length > 30 ? (
            <CardContent className="text-[0.8125rem] text-ink-subtle">
              Weitere {done.length - 30} erledigte Aufgaben werden nicht angezeigt.
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
