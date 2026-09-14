'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';

export type StartState = { status: 'idle' } | { status: 'error'; message: string };

export async function startSession(_prev: StartState, formData: FormData): Promise<StartState> {
  const customerId = String(formData.get('customerId') ?? '');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_advice_session', {
    p_customer_id: customerId,
  });

  if (error || !data) {
    logger.info('advice_session_start_failed', { reason: safeId(error?.code ?? 'unknown') });
    const noTemplate = error?.message.includes('Beratungsvorlage');
    return {
      status: 'error',
      message: noTemplate
        ? 'Für Ihre Firma ist keine Beratungsvorlage veröffentlicht.'
        : error?.message.replace(/^.*?:\s*/, '') ?? 'Beratung konnte nicht gestartet werden.',
    };
  }

  const sessionId = String(data);
  logger.info('advice_session_started', { session: safeId(sessionId) });
  revalidatePath('/beratungen');
  redirect(`/beratung/${sessionId}`);
}
