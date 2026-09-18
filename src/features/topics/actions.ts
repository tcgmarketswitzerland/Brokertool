'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';

export type TopicActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

const schema = z.array(z.object({
  topic_id: z.uuid(),
  is_enabled: z.boolean(),
  is_required: z.boolean(),
})).min(1);

/**
 * Spartenauswahl speichern.
 *
 * Die Reihenfolge des Arrays ist die Reihenfolge im Beratungsrad. Die
 * Datenbank macht daraus eine neue Vorlagenversion - laufende Beratungen
 * behalten ihre.
 */
export async function saveTopicSelection(
  _prev: TopicActionState, formData: FormData,
): Promise<TopicActionState> {
  let parsed;
  try {
    parsed = schema.safeParse(JSON.parse(String(formData.get('auswahl') ?? '')));
  } catch {
    return { status: 'error', message: 'Die Auswahl konnte nicht gelesen werden.' };
  }
  if (!parsed.success) {
    return { status: 'error', message: 'Die Auswahl konnte nicht gelesen werden.' };
  }

  if (!parsed.data.some((t) => t.is_enabled)) {
    return { status: 'error', message: 'Mindestens eine Sparte muss aktiv bleiben.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('publish_topic_selection', { p_topics: parsed.data });

  if (error) {
    logger.info('topic_selection_failed', { reason: safeId(error.code ?? 'unknown') });
    return {
      status: 'error',
      message: error.message.includes('Berechtigung')
        ? 'Die Spartenauswahl ändert die Firmenleitung.'
        : 'Die Auswahl konnte nicht gespeichert werden.',
    };
  }

  revalidatePath('/einstellungen/sparten');
  return {
    status: 'ok',
    message: 'Gespeichert. Laufende Beratungen behalten ihre bisherige Auswahl.',
  };
}
