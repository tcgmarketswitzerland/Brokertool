'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { IMPORT_FIELDS, type ImportField } from '@/domain/customer/csv';

const rowSchema = z.object({
  line: z.number().int().positive(),
  values: z.partialRecord(z.enum(IMPORT_FIELDS), z.string()),
});

const payloadSchema = z.object({
  rows: z.array(rowSchema).min(1).max(2000),
});

export type ImportResult =
  | { status: 'idle' }
  | { status: 'ok'; imported: number; failed: { line: number; reason: string }[] }
  | { status: 'error'; message: string };

/**
 * Der Client hat bereits geprueft; der Server prueft erneut (Regel R7). Die
 * Zeilen kommen als JSON und nicht als Datei, weil das Zuordnen der Spalten
 * ein Zwischenschritt im Browser ist - der Server sieht nur noch die fertige
 * Abbildung.
 */
export async function importCustomers(
  _prev: ImportResult, formData: FormData,
): Promise<ImportResult> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get('rows') ?? ''));
  } catch {
    return { status: 'error', message: 'Die Daten konnten nicht gelesen werden.' };
  }

  const parsed = payloadSchema.safeParse({ rows: payload });
  if (!parsed.success) {
    return { status: 'error', message: 'Keine gültigen Zeilen. Höchstens 2000 auf einmal.' };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  const failed: { line: number; reason: string }[] = [];
  let imported = 0;

  for (const row of parsed.data.rows) {
    const v = row.values as Partial<Record<ImportField, string>>;
    if (!v.firstName || !v.lastName) {
      failed.push({ line: row.line, reason: 'Vorname oder Nachname fehlt' });
      continue;
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        customer_type: 'PRIVATE',
        external_ref: v.externalRef ?? null,
        created_by: auth.user.id,
      })
      .select('id')
      .single();

    if (error || !customer) {
      failed.push({ line: row.line, reason: 'Kunde konnte nicht angelegt werden' });
      continue;
    }

    const customerId = String(customer.id);

    const { error: personError } = await supabase.from('customer_persons').insert({
      customer_id: customerId,
      person_role: 'PRIMARY',
      first_name: v.firstName,
      last_name: v.lastName,
      date_of_birth: v.dateOfBirth ?? null,
      email: v.email ?? null,
      phone: v.phone ?? null,
      created_by: auth.user.id,
    });

    if (personError) {
      // Kein namenloser Rest: der eben angelegte Kunde wird wieder entfernt.
      await supabase.from('customers').delete().eq('id', customerId);
      failed.push({ line: row.line, reason: 'Person konnte nicht angelegt werden' });
      continue;
    }

    if (v.street || v.postalCode || v.city) {
      await supabase.from('customer_addresses').insert({
        customer_id: customerId,
        kind: 'HOME',
        street: v.street ?? null,
        postal_code: v.postalCode ?? null,
        city: v.city ?? null,
      });
    }

    imported += 1;
  }

  logger.info('customers_imported', { imported, failed: failed.length, actor: safeId(auth.user.id) });
  revalidatePath('/kunden');

  return { status: 'ok', imported, failed };
}
