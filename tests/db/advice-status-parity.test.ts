import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, resetSchema } from './helpers/db';
import {
  applyOutcome, OUTCOMES, PROGRESS_STATUSES, type Outcome, type ProgressStatus,
} from '@/domain/advice/status';

/**
 * Das Statusmodell existiert zweimal: als reine Funktion in der Domaene,
 * damit es ohne Datenbank testbar ist, und als CHECK-Constraint in der
 * Datenbank, damit es sich ueber keinen anderen Weg umgehen laesst.
 *
 * Dieser Test haelt beide aufeinander abgestimmt. Ohne ihn wuerde eine
 * Lockerung an einer Stelle unbemerkt bleiben - und genau dann ist die
 * doppelte Absicherung keine mehr.
 */

let client: Client;
let sessionId = '';
let orgId = '';
const USER = '00000000-0000-4000-8000-00000000ab01';

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(`insert into auth.users (id, email) values ($1,'status@broker.ch')`, [USER]);
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: USER, role: 'authenticated' })]);
  orgId = (await client.query('select create_organization($1) as id', ['Status AG'])).rows[0].id;

  const customer = (await client.query(
    `insert into customers (organization_id) values ($1) returning id`, [orgId])).rows[0].id;
  await client.query(
    `insert into customer_persons (organization_id, customer_id, first_name, last_name)
     values ($1,$2,'Max','Muster')`, [orgId, customer]);

  const version = (await client.query(
    `select v.id from advice_template_versions v
       join advice_templates t on t.id = v.template_id
      where t.organization_id = $1`, [orgId])).rows[0].id;
  const member = (await client.query(
    `select id from organization_members where organization_id = $1`, [orgId])).rows[0].id;

  sessionId = (await client.query(
    `insert into advice_sessions
       (organization_id, customer_id, template_version_id, advisor_member_id, status, started_at)
     values ($1,$2,$3,$4,'IN_PROGRESS', now()) returning id`,
    [orgId, customer, version, member])).rows[0].id;
}, 60_000);

afterAll(async () => { await client?.end(); });

/** Versucht einen Zustand direkt in der Datenbank zu schreiben. */
let lastError = '';

async function dbAccepts(progress: ProgressStatus, outcome: Outcome | null): Promise<boolean> {
  const topic = (await client.query(`select id from insurance_topics limit 1`)).rows[0].id;
  await client.query('begin');
  try {
    await client.query(
      `insert into advice_session_topics
         (organization_id, session_id, topic_id, progress_status, outcome, discussed_at)
       values ($1,$2,$3,$4::topic_progress_status,$5::topic_outcome,
               case when $4::topic_progress_status = 'DISCUSSED' then now() else null end)`,
      [orgId, sessionId, topic, progress, outcome]);
    return true;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    return false;
  } finally {
    await client.query('rollback');
  }
}

describe('Statusmodell: Datenbank und Domaene', () => {
  const kombinationen = PROGRESS_STATUSES.flatMap((p) =>
    [null, ...OUTCOMES].map((o) => [p, o] as const));

  it.each(kombinationen)('%s mit Ergebnis %s', async (progress, outcome) => {
    const domaene = applyOutcome({ progressStatus: progress, outcome: null }, outcome).ok;
    const datenbank = await dbAccepts(progress, outcome);
    expect(datenbank, `Domäne: ${domaene}, Datenbank: ${datenbank} (${lastError})`).toBe(domaene);
  });

  it('DISCUSSED ohne Zeitstempel wird abgelehnt', async () => {
    const topic = (await client.query(`select id from insurance_topics limit 1`)).rows[0].id;
    await expect(client.query(
      `insert into advice_session_topics
         (organization_id, session_id, topic_id, progress_status)
       values ($1,$2,$3,'DISCUSSED')`, [orgId, sessionId, topic]),
    ).rejects.toThrow(/discussed_requires_timestamp/);
  });

  it('dieselbe Sparte kommt in einer Beratung nur einmal vor', async () => {
    const topic = (await client.query(`select id from insurance_topics limit 1`)).rows[0].id;
    await client.query(
      `insert into advice_session_topics (organization_id, session_id, topic_id)
       values ($1,$2,$3)`, [orgId, sessionId, topic]);
    await expect(client.query(
      `insert into advice_session_topics (organization_id, session_id, topic_id)
       values ($1,$2,$3)`, [orgId, sessionId, topic]),
    ).rejects.toThrow(/session_id_topic_id/);
  });
});

describe('Notizen', () => {
  it('genau ein Bezug je Notiz', async () => {
    await expect(client.query(
      `insert into notes (organization_id, session_id, session_topic_id, body)
       values ($1,$2,$3,'zwei Bezuege')`,
      [orgId, sessionId, (await client.query(
        `select id from advice_session_topics limit 1`)).rows[0].id]),
    ).rejects.toThrow(/notes_exactly_one_owner/);
  });

  it('Notizen sind standardmaessig geteilt, nicht intern', async () => {
    // Die sichere Vorgabe waere INTERNAL - fachlich falsch: die meisten
    // Notizen im Gespraech gehoeren ins Protokoll. Wichtig ist, dass die
    // Wahl bewusst getroffen und sichtbar ist.
    const { rows } = await client.query(
      `insert into notes (organization_id, session_id, body)
       values ($1,$2,'Kunde wuenscht hoehere Deckung') returning visibility`, [orgId, sessionId]);
    expect(rows[0].visibility).toBe('SHARED');
  });
});

describe('Command-Log', () => {
  it('derselbe Befehl zweimal ergibt genau eine Zeile', async () => {
    const id = '11111111-2222-4333-8444-555555555555';
    for (let i = 0; i < 2; i += 1) {
      await client.query(
        `insert into advice_command_log (id, organization_id, session_id, command_type, client_seq)
         values ($1,$2,$3,'TOPIC_SET_OUTCOME',1) on conflict (id) do nothing`,
        [id, orgId, sessionId]);
    }
    const { rows } = await client.query(
      `select count(*)::int as n from advice_command_log where id = $1`, [id]);
    expect(rows[0].n).toBe(1);
  });

  it('hat keine Update- und keine Delete-Policy', async () => {
    // Waere der Log manipulierbar, liesse sich ein Befehl ein zweites Mal
    // anwenden und die Idempotenz waere wertlos.
    const { rows } = await client.query(
      `select polname from pg_policy
        where polrelid = 'public.advice_command_log'::regclass and polcmd in ('w','d','*')`);
    expect(rows).toEqual([]);
  });
});
