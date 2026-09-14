import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, resetSchema } from './helpers/db';

/**
 * Beratung starten: Themen werden aus der Vorlagenversion instanziiert.
 * Der Snapshot-Gedanke auf Zeilenebene - aendert die Firma spaeter ihre
 * Vorlage, bleibt eine laufende Beratung davon unberuehrt.
 */

let client: Client;
const USER = '00000000-0000-4000-8000-00000000ba01';
const BACKOFFICE = '00000000-0000-4000-8000-00000000ba02';
let orgId = '';
let customerId = '';

async function asRole<T>(role: string, userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: userId, app_metadata: { organization_id: orgId, organization_role: role } })]);
  return fn();
}

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'gina@broker.ch'), ($2,'gil@broker.ch')`,
    [USER, BACKOFFICE]);

  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: USER, role: 'authenticated' })]);
  orgId = (await client.query('select create_organization($1) as id', ['Gina AG'])).rows[0].id;

  await client.query(
    `insert into organization_members (organization_id, user_id, role, display_name, email)
     values ($1,$2,'BACKOFFICE','Gil','gil@broker.ch')`, [orgId, BACKOFFICE]);

  customerId = (await client.query(
    `insert into customers (organization_id, customer_type) values ($1,'FAMILY') returning id`,
    [orgId])).rows[0].id;
  await client.query(
    `insert into customer_persons (organization_id, customer_id, person_role, first_name, last_name)
     values ($1,$2,'PRIMARY','Max','Muster'), ($1,$2,'PARTNER','Anna','Muster'),
            ($1,$2,'CHILD','Lea','Muster')`, [orgId, customerId]);
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Beratung starten', () => {
  let sessionId = '';

  it('legt die Beratung mit allen Sparten der Vorlage an', async () => {
    sessionId = await asRole('ADVISOR', USER, async () =>
      (await client.query('select start_advice_session($1) as id', [customerId])).rows[0].id);

    const { rows } = await client.query(
      `select count(*)::int as n from advice_session_topics where session_id = $1`, [sessionId]);
    expect(rows[0].n).toBe(11);
  });

  it('uebernimmt Reihenfolge und Pflichtkennzeichen aus der Vorlage', async () => {
    const { rows } = await client.query(
      `select it.slug, t.is_required from advice_session_topics t
         join insurance_topics it on it.id = t.topic_id
        where t.session_id = $1 order by t.display_order limit 2`, [sessionId]);
    expect(rows.map((r) => r.slug)).toEqual(['hausrat', 'privathaftpflicht']);
    expect(rows.every((r) => r.is_required)).toBe(true);
  });

  it('startet mit dem Status IN_PROGRESS und einem Startzeitpunkt', async () => {
    const { rows } = await client.query(
      `select status, started_at from advice_sessions where id = $1`, [sessionId]);
    expect(rows[0].status).toBe('IN_PROGRESS');
    expect(rows[0].started_at).not.toBeNull();
  });

  it('merkt Erwachsene als Teilnehmende vor, aber keine Kinder', async () => {
    const { rows } = await client.query(
      `select display_name from advice_session_participants where session_id = $1 order by display_name`,
      [sessionId]);
    expect(rows.map((r) => r.display_name)).toEqual(['Anna Muster', 'Max Muster']);
  });

  it('alle Themen beginnen unbesprochen und ohne Ergebnis', async () => {
    const { rows } = await client.query(
      `select distinct progress_status, outcome, coverage_state
         from advice_session_topics where session_id = $1`, [sessionId]);
    expect(rows).toEqual([
      { progress_status: 'NOT_STARTED', outcome: null, coverage_state: 'UNKNOWN' },
    ]);
  });
});

describe('Abgeschaltete Sparten', () => {
  it('erscheinen in neuen Beratungen nicht mehr, in bestehenden unveraendert', async () => {
    const alt = await asRole('ADVISOR', USER, async () =>
      (await client.query('select start_advice_session($1) as id', [customerId])).rows[0].id);

    const cyber = (await client.query(
      `select id from insurance_topics where slug = 'cyber'`)).rows[0].id;
    await client.query(
      `insert into organization_topic_settings (organization_id, topic_id, is_enabled)
       values ($1,$2,false)`, [orgId, cyber]);

    const neu = await asRole('ADVISOR', USER, async () =>
      (await client.query('select start_advice_session($1) as id', [customerId])).rows[0].id);

    const zaehle = async (session: string) => (await client.query(
      `select count(*)::int as n from advice_session_topics
        where session_id = $1 and topic_id = $2`, [session, cyber])).rows[0].n;

    expect(await zaehle(alt), 'bestehende Beratung').toBe(1);
    expect(await zaehle(neu), 'neue Beratung').toBe(0);
  });
});

describe('Berechtigungen', () => {
  it('das Backoffice darf keine Beratung starten', async () => {
    // Es pflegt Vertraege und Aufgaben nach, fuehrt aber keine Beratung
    // (Konzeptpunkt 20).
    await expect(
      asRole('BACKOFFICE', BACKOFFICE, () =>
        client.query('select start_advice_session($1)', [customerId])),
    ).rejects.toThrow(/Keine Berechtigung/);
  });

  it('ein fremder Kunde wird nicht gefunden', async () => {
    await expect(
      asRole('ADVISOR', USER, () => client.query(
        'select start_advice_session($1)', ['00000000-0000-4000-8000-00000000dead'])),
    ).rejects.toThrow(/Kunde nicht gefunden/);
  });
});
