'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { PENSION_CASES, PILLARS } from '@/domain/pension/types';

export type PensionState =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'error'; message: string };

const benefitSchema = z.object({
  key: z.string().max(60),
  pillar: z.enum(PILLARS),
  label: z.string().max(120),
  annualCents: z.number().int().min(0).max(100_000_000),
  perChildCents: z.number().int().min(0).max(100_000_000),
  requiresPartner: z.boolean(),
});

const schema = z.object({
  sessionId: z.uuid(),
  customerId: z.uuid(),
  annualIncomeCents: z.number().int().min(0).max(100_000_000).nullable(),
  hasPartner: z.boolean(),
  partnerIncomeCents: z.number().int().min(0).max(100_000_000).nullable(),
  childCount: z.number().int().min(0).max(12),
  targetPercent: z.number().min(0).max(200).nullable(),
  values: z.partialRecord(z.string().max(60), z.string().max(30)),
  benefits: z.partialRecord(z.enum(PENSION_CASES), z.array(benefitSchema).max(20)),
});

/**
 * Die Analyse speichern.
 *
 * Eine Zeile je Beratung, beim ersten Speichern angelegt. Der Browser
 * schickt den ganzen Stand - die Analyse ist eine Einheit, und ein
 * teilweise gespeicherter Stand waere im Protokoll schlimmer als ein
 * alter.
 */
export async function savePensionAnalysis(payload: unknown): Promise<PensionState> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { status: 'error', message: 'Eingabe prüfen.' };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  const v = parsed.data;
  const { error } = await supabase.from('pension_analyses').upsert({
    session_id: v.sessionId,
    customer_id: v.customerId,
    annual_income_cents: v.annualIncomeCents,
    has_partner: v.hasPartner,
    partner_income_cents: v.partnerIncomeCents,
    child_count: v.childCount,
    target_percent: v.targetPercent,
    // Die Rohwerte reisen unter einem eigenen Schluessel mit, damit das
    // Formular beim Wiederoeffnen genau so aussieht wie beim Verlassen.
    items: { ...v.benefits, __values: v.values },
    updated_by: auth.user.id,
    created_by: auth.user.id,
  }, { onConflict: 'session_id' });

  if (error) {
    logger.info('pension_save_failed', {
      session: safeId(v.sessionId), reason: safeId(error.code ?? 'unknown'),
    });
    return { status: 'error', message: 'Die Analyse konnte nicht gespeichert werden.' };
  }

  revalidatePath(`/beratung/${v.sessionId}`);
  return { status: 'ok' };
}
