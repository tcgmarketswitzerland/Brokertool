'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { nextCancellationDate } from '@/domain/policy/types';
import type { Json } from '@/types/database';
import { getCompletionData } from '@/features/advice/completion/queries';
import { DEMO_CUSTOMERS, DEMO_OUTCOMES, type DemoCustomer } from './fixtures';

export type DemoState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

type Client = SupabaseClient;

/** Kennungen aus den Katalogen, damit die Fixtures mit Namen arbeiten können. */
async function catalogs(supabase: Client) {
  const [topics, insurers] = await Promise.all([
    supabase.from('insurance_topics').select('id, slug'),
    supabase.from('insurers').select('id, name'),
  ]);
  return {
    topicId: (slug: string) =>
      (topics.data ?? []).find((t) => t.slug === slug)?.id as string | undefined,
    insurerId: (name: string) =>
      (insurers.data ?? []).find((i) => i.name === name)?.id as string | undefined,
  };
}

async function insertCustomer(
  supabase: Client, userId: string, demo: DemoCustomer,
  catalog: Awaited<ReturnType<typeof catalogs>>,
): Promise<string | null> {
  // organization_id und primary_advisor_id kommen aus den Spalten-Defaults
  // (Regel R5): die Firma aus dem Token, der zustaendige Berater aus dem
  // member_id-Claim. Genau wie beim Anlegen von Hand.
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({ customer_type: demo.type, is_demo: true, created_by: userId })
    .select('id')
    .single();
  if (error || !customer) return null;

  const customerId = String(customer.id);

  const { error: personError } = await supabase.from('customer_persons').insert(
    demo.persons.map((p) => ({
      customer_id: customerId,
      person_role: p.role,
      first_name: p.firstName,
      last_name: p.lastName,
      date_of_birth: p.dateOfBirth,
      sex: p.sex,
      occupation: p.occupation ?? null,
      annual_income_cents: p.annualIncomeFranken == null
        ? null : p.annualIncomeFranken * 100,
      created_by: userId,
    })));
  if (personError) return null;

  await supabase.from('customer_addresses').insert({
    customer_id: customerId,
    kind: 'HOME',
    street: demo.street,
    postal_code: demo.postalCode,
    city: demo.city,
  });

  const policies = demo.policies
    .map((p) => {
      const topicId = catalog.topicId(p.topicSlug);
      if (!topicId) return null;
      const insurerId = catalog.insurerId(p.insurerName);
      // Ein Ablauf in rund einem Jahr, damit die Kachel "bald kuendbar"
      // etwas zu zeigen hat.
      const endDate = new Date(Date.now() + 300 * 86_400_000).toISOString().slice(0, 10);
      return {
        customer_id: customerId,
        topic_id: topicId,
        insurer_id: insurerId ?? null,
        insurer_name: insurerId ? null : p.insurerName,
        product_name: p.productName ?? null,
        premium_cents: p.premiumFranken * 100,
        premium_frequency: p.frequency,
        end_date: endDate,
        notice_period_months: 3,
        next_cancellation_date: nextCancellationDate(endDate, 3),
        created_by: userId,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (policies.length > 0) await supabase.from('policies').insert(policies);

  return customerId;
}

/**
 * Eine abgeschlossene Beratung samt Protokoll.
 *
 * Bewusst ueber dieselben Wege wie eine echte: start_advice_session,
 * Ergebnisse je Sparte, dann complete_advice_session mit dem Dokument,
 * das getCompletionData baut. Ein zweiter, eigener Weg zum Abschluss
 * waere eine zweite Wahrheit darueber, was ein Abschluss bedeutet - und
 * die Demodaten saehen anders aus als das, was der Berater erzeugt.
 */
async function completedSession(
  supabase: Client, userId: string, customerId: string,
): Promise<boolean> {
  const { data: sessionId, error } = await supabase
    .rpc('start_advice_session', { p_customer_id: customerId });
  if (error || !sessionId) return false;
  const id = String(sessionId);

  const { data: topics } = await supabase
    .from('advice_session_topics')
    .select('id, topic_id, insurance_topics ( slug )')
    .eq('session_id', id);

  const discussedAt = new Date().toISOString();

  for (const row of topics ?? []) {
    const slug = String(
      (row.insurance_topics as { slug?: unknown } | null)?.slug ?? '');
    const planned = DEMO_OUTCOMES.find((o) => o.topicSlug === slug);
    if (!planned) continue;

    await supabase.from('advice_session_topics').update({
      progress_status: 'DISCUSSED',
      outcome: planned.outcome,
      coverage_state: planned.coverage,
      discussed_at: discussedAt,
    }).eq('id', String(row.id));

    // Genau ein Bezug je Notiz: haengt sie an einer Sparte, dann nicht
    // zusaetzlich an der Beratung.
    await supabase.from('notes').insert({
      session_topic_id: String(row.id),
      visibility: 'SHARED',
      body: planned.note,
      created_by: userId,
    });
  }

  const data = await getCompletionData(id);
  if (!data) return false;

  const { error: completeError } = await supabase.rpc('complete_advice_session', {
    p_session_id: id,
    p_document: data.document as unknown as Json,
  });
  return !completeError;
}

/** Eine laufende Beratung, damit die Uebersicht nicht nur Abgeschlossenes zeigt. */
async function openSession(supabase: Client, customerId: string): Promise<void> {
  const { data: sessionId } = await supabase
    .rpc('start_advice_session', { p_customer_id: customerId });
  if (!sessionId) return;

  const { data: topics } = await supabase
    .from('advice_session_topics')
    .select('id')
    .eq('session_id', String(sessionId))
    .limit(2);

  for (const row of topics ?? []) {
    await supabase.from('advice_session_topics').update({
      progress_status: 'DISCUSSED',
      outcome: 'NO_ACTION_NEEDED',
      coverage_state: 'COVER_EXISTS',
      discussed_at: new Date().toISOString(),
    }).eq('id', String(row.id));
  }
}

export async function createDemoData(
  _prev: DemoState, _formData: FormData,
): Promise<DemoState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  const { count } = await supabase
    .from('customers').select('id', { count: 'exact', head: true }).eq('is_demo', true);
  if ((count ?? 0) > 0) {
    return { status: 'error', message: 'Es gibt bereits Demodaten.' };
  }

  const catalog = await catalogs(supabase);
  const created: string[] = [];

  for (const demo of DEMO_CUSTOMERS) {
    const id = await insertCustomer(supabase, auth.user.id, demo, catalog);
    if (!id) {
      logger.info('demo_create_failed', { step: safeId('customer') });
      return {
        status: 'error',
        message: 'Die Demodaten konnten nicht angelegt werden. '
               + 'Fehlen Ihnen die Rechte, Kunden zu erfassen?',
      };
    }
    created.push(id);
  }

  const [first, second] = created;
  if (first) await completedSession(supabase, auth.user.id, first);
  if (second) await openSession(supabase, second);

  logger.info('demo_created', { customers: safeId(String(created.length)) });
  revalidatePath('/', 'layout');
  return {
    status: 'ok',
    message: `${created.length} Demokunden angelegt, mit Verträgen, einer `
           + 'abgeschlossenen Beratung samt Protokoll und einer laufenden.',
  };
}

export async function removeDemoData(
  _prev: DemoState, _formData: FormData,
): Promise<DemoState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_demo_data');

  if (error) {
    logger.info('demo_remove_failed', { reason: safeId(error.code ?? 'unknown') });
    return {
      status: 'error',
      message: /Berechtigung/.test(error.message)
        ? 'Demodaten entfernt die Firmenleitung.'
        : 'Die Demodaten konnten nicht entfernt werden.',
    };
  }

  revalidatePath('/', 'layout');
  return { status: 'ok', message: 'Demodaten entfernt.' };
}
