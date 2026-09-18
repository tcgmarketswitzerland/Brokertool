import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { claimsFor, connect, resetSchema } from './helpers/db';

/**
 * Dokumente.
 *
 * Die Dateien liegen im Objektspeicher, die Zugriffspruefung aber hier:
 * Storage-Richtlinien setzen Eigentum an storage.objects voraus, das ein
 * Supabase-Projekt nicht hergibt (Migration 0024). Gibt die Tabelle die
 * Zeile nicht heraus, kommt auch die Datei nicht heraus - deshalb wird
 * genau das geprueft.
 */

let client: Client;
const A = '00000000-0000-4000-8000-00000000d0a1';
const B = '00000000-0000-4000-8000-00000000d0a2';
let orgA = '';
let orgB = '';
let customerA = '';
let topicA = '';
let sessionA = '';

async function asRole<T>(
  orgId: string, role: string, userId: string, fn: () => Promise<T>,
): Promise<T> {
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [await claimsFor(client, orgId, role, userId)]);
  await client.query('set role authenticated');
  try {
    return await fn();
  } finally {
    await client.query('reset role');
  }
}

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'doa@broker.ch'), ($2,'dob@broker.ch')`,
    [A, B]);

  for (const [user, name] of [[A, 'Doa AG'], [B, 'Dob AG']] as const) {
    await client.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({ sub: user, role: 'authenticated' })]);
    const { rows } = await client.query('select create_organization($1) as id', [name]);
    if (user === A) orgA = rows[0].id; else orgB = rows[0].id;
  }

  // Zustaendiger Berater, wie ihn die Anwendung setzt: seit 0026 sieht ein
  // Berater nur Kunden, die ihm zugeordnet sind.
  const memberA = (await client.query(
    `select id from organization_members where organization_id = $1 and user_id = $2`,
    [orgA, A])).rows[0].id;

  customerA = (await client.query(
    `insert into customers (organization_id, customer_type, primary_advisor_id)
     values ($1,'PRIVATE',$2) returning id`,
    [orgA, memberA])).rows[0].id;
  await client.query(
    `insert into customer_persons (organization_id, customer_id, person_role, first_name, last_name)
     values ($1,$2,'PRIMARY','Max','Muster')`, [orgA, customerA]);

  topicA = (await client.query(
    `select id from insurance_topics order by display_order limit 1`)).rows[0].id;

  sessionA = await asRole(orgA, 'ADVISOR', A, async () =>
    (await client.query('select start_advice_session($1) as id', [customerA])).rows[0].id);
}, 60_000);

afterAll(async () => { await client?.end(); });

let counter = 0;

function insertDocument(fields: Record<string, unknown> = {}) {
  counter += 1;
  const base: Record<string, unknown> = {
    customer_id: customerA,
    topic_id: topicA,
    original_filename: 'Police.pdf',
    storage_path: `${orgA}/${customerA}/datei-${counter}.pdf`,
    mime_type: 'application/pdf',
    size_bytes: 12_345,
    kind: 'POLICY',
    ...fields,
  };
  const keys = Object.keys(base);
  return client.query(
    `insert into documents (${keys.join(', ')})
     values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    keys.map((k) => base[k]));
}

describe('Dokumente', () => {
  it('haengt ein Dokument an eine Sparte', async () => {
    const id = await asRole(orgA, 'ADVISOR', A, async () =>
      (await insertDocument({ session_id: sessionA })).rows[0].id);

    const { rows } = await client.query(
      'select topic_id, organization_id from documents where id = $1', [id]);
    expect(rows[0].topic_id).toBe(topicA);
    // Die Organisation kommt aus dem Vorgabewert, nicht aus der Anfrage.
    expect(rows[0].organization_id).toBe(orgA);
  });

  it('zeigt das Dokument der fremden Firma nicht', async () => {
    const id = await asRole(orgA, 'ADVISOR', A, async () =>
      (await insertDocument()).rows[0].id);

    const seen = await asRole(orgB, 'OWNER', B, async () =>
      (await client.query('select id from documents where id = $1', [id])).rowCount);
    expect(seen).toBe(0);
  });

  it('weist ein Dokument ohne jeden Bezug zurueck', async () => {
    // Ohne Kunde, Police oder Beratung waere die Datei spaeter nicht mehr
    // auffindbar - und damit auch nicht mehr loeschbar.
    await expect(asRole(orgA, 'ADVISOR', A, async () =>
      insertDocument({ customer_id: null, topic_id: null })))
      .rejects.toThrow();
  });

  it('haelt den Pfad projektweit eindeutig', async () => {
    const path = `${orgA}/${customerA}/doppelt.pdf`;
    await asRole(orgA, 'ADVISOR', A, async () => insertDocument({ storage_path: path }));
    await expect(asRole(orgA, 'ADVISOR', A, async () =>
      insertDocument({ storage_path: path }))).rejects.toThrow(/storage_path/);
  });

  it('friert Dokumente einer abgeschlossenen Beratung ein', async () => {
    const id = await asRole(orgA, 'ADVISOR', A, async () =>
      (await insertDocument({ session_id: sessionA })).rows[0].id);

    await client.query(
      `update advice_session_topics
          set progress_status='DISCUSSED', outcome='NO_ACTION_NEEDED', discussed_at=now()
        where session_id = $1`, [sessionA]);
    await asRole(orgA, 'ADVISOR', A, async () =>
      client.query('select complete_advice_session($1, $2::jsonb)',
        [sessionA, JSON.stringify({ schemaVersion: 1 })]));

    await expect(client.query(
      'update documents set deleted_at = now() where id = $1', [id]))
      .rejects.toThrow(/unveraenderlich/);
  });

  it('laesst ein Kundendokument ohne Beratung weiterhin entfernen', async () => {
    const id = await asRole(orgA, 'ADVISOR', A, async () =>
      (await insertDocument()).rows[0].id);

    const { rowCount } = await client.query(
      'update documents set deleted_at = now() where id = $1', [id]);
    expect(rowCount).toBe(1);
  });
});
