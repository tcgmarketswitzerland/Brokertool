'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { taskSchema, taskStatusSchema, type TaskActionState } from './schemas';

export async function createTask(
  _prev: TaskActionState, formData: FormData,
): Promise<TaskActionState> {
  const parsed = taskSchema.safeParse({
    customerId: formData.get('customerId'),
    sessionId: formData.get('sessionId'),
    sessionTopicId: formData.get('sessionTopicId'),
    ownerType: formData.get('ownerType'),
    title: formData.get('title'),
    description: formData.get('description'),
    priority: formData.get('priority') ?? 'NORMAL',
    dueDate: formData.get('dueDate'),
  });

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Eingabe prüfen.' };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  // Eine Berateraufgabe braucht einen Zustaendigen, sonst bleibt sie liegen.
  // Vorbelegt ist, wer sie erfasst - im Gespraech ist das fast immer richtig.
  let assignee: string | null = null;
  if (v.ownerType === 'ADVISOR') {
    const { data } = await supabase
      .from('organization_members').select('id').eq('user_id', auth.user.id).maybeSingle();
    assignee = data ? String(data.id) : null;
    if (!assignee) return { status: 'error', message: 'Keine aktive Mitgliedschaft.' };
  }

  const { error } = await supabase.from('tasks').insert({
    customer_id: v.customerId ?? null,
    session_id: v.sessionId ?? null,
    session_topic_id: v.sessionTopicId ?? null,
    owner_type: v.ownerType,
    assignee_member_id: assignee,
    title: v.title,
    description: v.description ?? null,
    priority: v.priority,
    due_date: v.dueDate ?? null,
    created_by: auth.user.id,
  });

  if (error) {
    logger.info('task_create_failed', { reason: safeId(error.code ?? 'unknown') });
    return { status: 'error', message: 'Aufgabe konnte nicht erstellt werden.' };
  }

  revalidatePath('/aufgaben');
  if (v.customerId) revalidatePath(`/kunden/${v.customerId}`);
  return { status: 'ok', message: 'Aufgabe erstellt.' };
}

export async function setTaskStatus(
  _prev: TaskActionState, formData: FormData,
): Promise<TaskActionState> {
  const parsed = taskStatusSchema.safeParse({
    taskId: formData.get('taskId'),
    status: formData.get('status'),
  });
  if (!parsed.success) return { status: 'error', message: 'Eingabe prüfen.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('tasks')
    .update({
      status: parsed.data.status,
      // Der Zeitstempel gehoert zum Status: der CHECK-Constraint verlangt
      // ihn, und ohne ihn liesse sich spaeter nicht sagen, wann etwas
      // erledigt wurde.
      completed_at: parsed.data.status === 'DONE' ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data.taskId);

  if (error) return { status: 'error', message: 'Status konnte nicht geändert werden.' };

  revalidatePath('/aufgaben');
  return { status: 'ok', message: 'Aktualisiert.' };
}
