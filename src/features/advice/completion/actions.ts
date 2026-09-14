'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { dueDateFrom } from '@/domain/task/suggestions';
import type { SummaryInputTask } from '@/domain/advice/summary';
import type { Json } from '@/types/database';
import { getCompletionData } from './queries';

export type CompleteState = { status: 'idle' } | { status: 'error'; message: string };

const schema = z.object({
  sessionId: z.uuid(),
  /** Schluessel der bestaetigten Vorschlaege, als JSON-Liste aus dem Formular. */
  acceptedKeys: z.array(z.string().max(80)).max(50),
});

/**
 * Beratung abschliessen (Konzeptpunkt 29).
 *
 * Reihenfolge mit Absicht: erst die Folgeaufgaben, dann das Dokument, dann
 * der Abschluss. Das Protokoll listet die Aufgaben auf, die es tatsaechlich
 * gibt - und nach dem Abschluss laesst die Datenbank keine Aenderung mehr
 * zu, auch nicht das Nachtragen einer vergessenen Aufgabe.
 *
 * Das Dokument wird hier serverseitig neu gebaut. Was der Browser als
 * Vorschau anzeigt, ist Anzeige; massgeblich ist, was der Server aus der
 * Datenbank liest.
 */
export async function completeSession(
  _prev: CompleteState, formData: FormData,
): Promise<CompleteState> {
  const raw = formData.get('acceptedKeys');
  const parsed = schema.safeParse({
    sessionId: formData.get('sessionId'),
    acceptedKeys: typeof raw === 'string' && raw.length > 0 ? JSON.parse(raw) : [],
  });
  if (!parsed.success) return { status: 'error', message: 'Eingabe prüfen.' };

  const { sessionId, acceptedKeys } = parsed.data;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  const data = await getCompletionData(sessionId);
  if (!data) return { status: 'error', message: 'Beratung nicht gefunden.' };
  if (data.session.status === 'COMPLETED') redirect(`/beratungen/${sessionId}`);

  const accepted = new Set(acceptedKeys);
  const chosen = data.suggestions.filter((s) => accepted.has(s.key));

  const { data: member } = await supabase
    .from('organization_members').select('id').eq('user_id', auth.user.id).maybeSingle();
  if (!member) return { status: 'error', message: 'Keine aktive Mitgliedschaft.' };

  const sessionTopicId = (topicId: string) =>
    data.session.topics.find((t) => t.topicId === topicId)?.id ?? null;

  if (chosen.length > 0) {
    const { error } = await supabase.from('tasks').insert(chosen.map((s) => ({
      customer_id: data.session.customerId,
      session_id: sessionId,
      session_topic_id: sessionTopicId(s.topicId),
      owner_type: s.ownerType,
      assignee_member_id: s.ownerType === 'ADVISOR' ? String(member.id) : null,
      title: s.title,
      priority: s.priority,
      due_date: dueDateFrom(data.sessionDate, s.dueInDays),
      created_by: auth.user.id,
    })));

    if (error) {
      logger.info('advice_tasks_create_failed', { session: safeId(sessionId) });
      return { status: 'error', message: 'Die Folgeaufgaben konnten nicht erstellt werden.' };
    }
  }

  const tasks: SummaryInputTask[] = chosen.map((s) => ({
    ownerType: s.ownerType,
    title: s.title,
    dueDate: dueDateFrom(data.sessionDate, s.dueInDays),
  }));

  const final = await getCompletionData(sessionId, tasks);
  if (!final) return { status: 'error', message: 'Beratung nicht gefunden.' };

  const { error } = await supabase.rpc('complete_advice_session', {
    p_session_id: sessionId,
    // Das Dokument ist reines JSON; der Umweg ueber unknown ist noetig,
    // weil TypeScript readonly-Felder nicht auf den Json-Typ abbildet.
    p_document: final.document as unknown as Json,
  });

  if (error) {
    logger.info('advice_complete_failed', {
      session: safeId(sessionId), reason: safeId(error.code ?? 'unknown'),
    });
    return {
      status: 'error',
      message: /Pflichtbereiche offen/.test(error.message)
        ? error.message.replace(/^.*?:\s*/, '')
        : /Berechtigung/.test(error.message)
          ? 'Sie dürfen Beratungen nicht abschliessen.'
          : 'Die Beratung konnte nicht abgeschlossen werden.',
    };
  }

  logger.info('advice_completed', { session: safeId(sessionId) });
  revalidatePath('/beratungen');
  revalidatePath('/aufgaben');
  revalidatePath(`/kunden/${data.session.customerId}`);
  redirect(`/beratungen/${sessionId}`);
}
