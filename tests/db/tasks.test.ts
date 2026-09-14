import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, resetSchema } from './helpers/db';

/**
 * Aufgaben (Konzeptpunkt 11). Die Regeln stehen in der Datenbank, weil
 * eine Berateraufgabe ohne Zustaendigen in jeder Oberflaeche liegen
 * bleibt - nicht nur in dieser.
 */

let client: Client;
const USER = '00000000-0000-4000-8000-00000000da01';
let orgId = '';
let memberId = '';
let customerId = '';

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(`insert into auth.users (id, email) values ($1,'tina@broker.ch')`, [USER]);
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: USER, role: 'authenticated' })]);
  orgId = (await client.query('select create_organization($1) as id', ['Tina AG'])).rows[0].id;
  memberId = (await client.query(
    `select id from organization_members where organization_id = $1 and user_id = $2`,
    [orgId, USER])).rows[0].id;
  customerId = (await client.query(
    `insert into customers (organization_id, customer_type) values ($1,'PRIVATE') returning id`,
    [orgId])).rows[0].id;
}, 60_000);

afterAll(async () => { await client?.end(); });

async function insertTask(fields: Record<string, unknown>) {
  const base: Record<string, unknown> = {
    organization_id: orgId, customer_id: customerId, title: 'Offerte einholen', ...fields,
  };
  const keys = Object.keys(base);
  return client.query(
    `insert into tasks (${keys.join(', ')})
     values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning id, status`,
    keys.map((k) => base[k]));
}

describe('Aufgaben', () => {
  it('nimmt eine Kundenaufgabe ohne Zustaendigen an', async () => {
    // Beim Kunden ist der Zustaendige der Kunde - ein Mitglied waere falsch.
    const { rows } = await insertTask({ owner_type: 'CUSTOMER' });
    expect(rows[0].status).toBe('OPEN');
  });

  it('weist eine Berateraufgabe ohne Zustaendigen zurueck', async () => {
    await expect(insertTask({ owner_type: 'ADVISOR' }))
      .rejects.toThrow(/tasks_advisor_needs_assignee/);
  });

  it('nimmt eine Berateraufgabe mit Zustaendigem an', async () => {
    const { rows } = await insertTask({ owner_type: 'ADVISOR', assignee_member_id: memberId });
    expect(rows[0].id).toBeDefined();
  });

  it('verlangt zu "erledigt" einen Zeitpunkt', async () => {
    // Ohne ihn liesse sich spaeter nicht sagen, wann etwas erledigt wurde.
    await expect(insertTask({ owner_type: 'CUSTOMER', status: 'DONE' }))
      .rejects.toThrow(/tasks_done_needs_timestamp/);
  });

  it('weist einen leeren Titel zurueck', async () => {
    await expect(insertTask({ owner_type: 'CUSTOMER', title: '   ' }))
      .rejects.toThrow(/tasks_title_check/);
  });

  it('protokolliert jede Aufgabe im Audit-Log', async () => {
    const { rows } = await insertTask({ owner_type: 'CUSTOMER', title: 'Police bringen' });
    const audit = await client.query(
      `select count(*)::int as n from audit_logs
        where entity_table = 'tasks' and entity_id = $1 and action = 'INSERT'`, [rows[0].id]);
    expect(audit.rows[0].n).toBe(1);
  });

  it('loescht Aufgaben mit dem Kunden', async () => {
    const other = (await client.query(
      `insert into customers (organization_id, customer_type) values ($1,'PRIVATE') returning id`,
      [orgId])).rows[0].id;
    await insertTask({ owner_type: 'CUSTOMER', customer_id: other });
    await client.query('delete from customers where id = $1', [other]);
    const { rows } = await client.query(
      `select count(*)::int as n from tasks where customer_id = $1`, [other]);
    expect(rows[0].n).toBe(0);
  });
});
