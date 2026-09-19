import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { claimsFor, connect, resetSchema } from './helpers/db';
import { DEMO_CUSTOMERS, DEMO_OUTCOMES } from '@/features/demo/fixtures';

/**
 * Demodaten entfernen (Migration 0029).
 *
 * Der heikle Teil ist das Aufraeumen, nicht das Anlegen: an einer
 * abgeschlossenen Beratung haengen Snapshot und Unterschrift, und die
 * tragen absichtlich keine Delete-Policy. Die Funktion ist die eine
 * Ausnahme davon - eng gefasst auf die eigene Firma und auf
 * gekennzeichnete Zeilen. Genau das wird hier geprueft.
 */

let client: Client;
const CHEF = '00000000-0000-4000-8000-00000000de01';
const ANNA = '00000000-0000-4000-8000-00000000de02';
const FREMD = '00000000-0000-4000-8000-00000000de03';

let orgId = '';
let fremdOrg = '';
let demoCustomer = '';
let echtCustomer = '';
let fremdDemo = '';
let demoSession = '';

async function asRole<T>(
  org: string, role: string, userId: string, fn: () => Promise<T>,
): Promise<T> {
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [await claimsFor(client, org, role, userId)]);
  await client.query('set role authenticated');
  try {
    return await fn();
  } finally {
    await client.query('reset role');
  }
}

async function newCustomer(org: string, isDemo: boolean): Promise<string> {
  const { rows } = await client.query(
    `insert into customers (organization_id, customer_type, is_demo)
     values ($1,'PRIVATE',$2) returning id`, [org, isDemo]);
  const id = String(rows[0].id);
  await client.query(
    `insert into customer_persons (organization_id, customer_id, person_role, first_name, last_name)
     values ($1,$2,'PRIMARY','Nadja','Brunner')`, [org, id]);
  return id;
}

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email)
     values ($1,'chef@broker.ch'), ($2,'anna@broker.ch'), ($3,'fremd@broker.ch')`,
    [CHEF, ANNA, FREMD]);

  for (const [user, name] of [[CHEF, 'Chef AG'], [FREMD, 'Fremd AG']] as const) {
    await client.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({ sub: user, role: 'authenticated' })]);
    const { rows } = await client.query('select create_organization($1) as id', [name]);
    if (user === CHEF) orgId = rows[0].id; else fremdOrg = rows[0].id;
  }
  await client.query(
    `insert into organization_members (organization_id, user_id, role, display_name, email)
     values ($1,$2,'ADVISOR','Anna','anna@broker.ch')`, [orgId, ANNA]);

  demoCustomer = await newCustomer(orgId, true);
  echtCustomer = await newCustomer(orgId, false);
  fremdDemo = await newCustomer(fremdOrg, true);

  // Eine abgeschlossene Beratung am Demokunden, mit allem, was daran haengt.
  await client.query('update customers set primary_advisor_id = (select id from organization_members where organization_id = $1 and user_id = $2) where id = $3',
    [orgId, CHEF, demoCustomer]);
  demoSession = await asRole(orgId, 'OWNER', CHEF, async () =>
    (await client.query('select start_advice_session($1) as id', [demoCustomer])).rows[0].id);

  await client.query(
    `update advice_session_topics
        set progress_status='DISCUSSED', outcome='NO_ACTION_NEEDED', discussed_at=now()
      where session_id = $1`, [demoSession]);
  await client.query(
    `insert into notes (organization_id, session_topic_id, visibility, body)
     select $1, st.id, 'SHARED', 'Demonotiz'
       from advice_session_topics st where st.session_id = $2 limit 1`,
    [orgId, demoSession]);

  const snapshotId = await asRole(orgId, 'OWNER', CHEF, async () =>
    (await client.query('select complete_advice_session($1, $2::jsonb) as id',
      [demoSession, JSON.stringify({ schemaVersion: 1 })])).rows[0].id);

  await client.query(
    `insert into signatures (organization_id, session_id, snapshot_id, signer_name, image_base64)
     values ($1,$2,$3,'Nadja Brunner',$4)`,
    [orgId, demoSession, snapshotId, 'iVBORw0KGgo'.repeat(20)]);
}, 60_000);

afterAll(async () => { await client?.end(); });

async function counts() {
  const { rows } = await client.query(`
    select
      (select count(*) from customers where organization_id = $1 and is_demo)::int as demo,
      (select count(*) from customers where organization_id = $1 and not is_demo)::int as echt,
      (select count(*) from advice_sessions where customer_id = $2)::int as beratungen,
      (select count(*) from advice_session_snapshots where session_id = $3)::int as snapshots,
      (select count(*) from signatures where session_id = $3)::int as unterschriften,
      (select count(*) from customers where organization_id = $4 and is_demo)::int as fremd`,
    [orgId, demoCustomer, demoSession, fremdOrg]);
  return rows[0];
}

describe('Demodaten', () => {
  it('legt sich mit allem an, was an einer Beratung haengt', async () => {
    const before = await counts();
    expect(before.demo).toBe(1);
    expect(before.beratungen).toBe(1);
    expect(before.snapshots).toBe(1);
    expect(before.unterschriften).toBe(1);
  });

  it('laesst einen Berater nicht aufraeumen', async () => {
    await expect(asRole(orgId, 'ADVISOR', ANNA, async () =>
      client.query('select remove_demo_data()')))
      .rejects.toThrow(/Keine Berechtigung/);
  });

  it('entfernt Demokunden samt Beratung, Snapshot und Unterschrift', async () => {
    const removed = await asRole(orgId, 'OWNER', CHEF, async () =>
      (await client.query('select remove_demo_data() as n')).rows[0].n);
    expect(removed).toBe(1);

    const after = await counts();
    expect(after.demo).toBe(0);
    expect(after.beratungen).toBe(0);
    // Snapshot und Unterschrift tragen keine Delete-Policy; die Funktion
    // ist die eine Ausnahme - und sie muss vollstaendig aufraeumen, sonst
    // bliebe ein Protokoll ohne Kunden zurueck.
    expect(after.snapshots).toBe(0);
    expect(after.unterschriften).toBe(0);
  });

  it('laesst echte Kunden unberuehrt', async () => {
    const after = await counts();
    expect(after.echt).toBe(1);
    const { rowCount } = await client.query(
      'select id from customers where id = $1', [echtCustomer]);
    expect(rowCount).toBe(1);
  });

  it('laesst die Demodaten der fremden Firma unberuehrt', async () => {
    const after = await counts();
    expect(after.fremd).toBe(1);
    const { rowCount } = await client.query(
      'select id from customers where id = $1', [fremdDemo]);
    expect(rowCount).toBe(1);
  });

  it('bleibt ohne Demodaten ohne Wirkung', async () => {
    const removed = await asRole(orgId, 'OWNER', CHEF, async () =>
      (await client.query('select remove_demo_data() as n')).rows[0].n);
    expect(removed).toBe(0);
  });
});

/**
 * Die Fixtures arbeiten mit Namen, die Datenbank mit Kennungen. Ein
 * Tippfehler im Slug oder im Namen des Versicherers wuerde den Vertrag
 * still ueberspringen - die Demodaten waeren luecken- statt fehlerhaft,
 * und niemandem faellt es auf.
 */
describe('Demo-Fixtures gegen den Katalog', () => {
  it('kennt jede verwendete Sparte', async () => {
    const { rows } = await client.query(
      'select slug from insurance_topics where is_active');
    const known = new Set(rows.map((r) => String(r.slug)));

    const used = new Set<string>([
      ...DEMO_CUSTOMERS.flatMap((c) => c.policies.map((p) => p.topicSlug)),
      ...DEMO_OUTCOMES.map((o) => o.topicSlug),
    ]);
    expect([...used].filter((slug) => !known.has(slug))).toEqual([]);
  });

  it('kennt jeden verwendeten Versicherer', async () => {
    const { rows } = await client.query('select name from insurers where is_active');
    const known = new Set(rows.map((r) => String(r.name)));

    const used = new Set(DEMO_CUSTOMERS.flatMap((c) => c.policies.map((p) => p.insurerName)));
    expect([...used].filter((name) => !known.has(name))).toEqual([]);
  });

  // Sonst laesst sich die Demoberatung nicht abschliessen: der Abschluss
  // verlangt mindestens ein Ergebnis (Migration 0022).
  it('hat mindestens ein Ergebnis fuer die Demoberatung', () => {
    expect(DEMO_OUTCOMES.length).toBeGreaterThan(0);
  });

  it('hat zu jeder Ablehnung einen Hinweis, worauf hingewiesen wurde', () => {
    for (const outcome of DEMO_OUTCOMES.filter((o) => o.outcome === 'CLIENT_DECLINED')) {
      expect(outcome.note.trim().length).toBeGreaterThan(20);
    }
  });
});
