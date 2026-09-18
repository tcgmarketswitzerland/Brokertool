import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { claimsFor, connect, resetSchema } from './helpers/db';

/**
 * Zahlungsmittel (Migration 0027).
 *
 * Zwei Dinge werden hier geprueft: dass die Abrechnung nur dem Inhaber
 * offensteht - und dass keine Kartennummer in das Anzeigefeld gelangt.
 * Das zweite ist kein Formularproblem: ein Datenbankriegel haelt auch
 * dann, wenn ein Importskript oder ein spaeterer Endpunkt daran vorbei
 * will.
 */

let client: Client;
const CHEF = '00000000-0000-4000-8000-00000000ab01';
const ADMIN = '00000000-0000-4000-8000-00000000ab02';
let orgId = '';

async function asRole<T>(role: string, userId: string, fn: () => Promise<T>): Promise<T> {
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
    `insert into auth.users (id, email) values ($1,'chef@broker.ch'), ($2,'admin@broker.ch')`,
    [CHEF, ADMIN]);
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: CHEF, role: 'authenticated' })]);
  orgId = (await client.query('select create_organization($1) as id', ['Chef AG'])).rows[0].id;
  await client.query(
    `insert into organization_members (organization_id, user_id, role, display_name, email)
     values ($1,$2,'ADMIN','Adam','adam@broker.ch')`, [orgId, ADMIN]);
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Zahlungsmittel', () => {
  it('laesst den Inhaber eines hinterlegen', async () => {
    const id = await asRole('OWNER', CHEF, async () =>
      (await client.query(
        `insert into payment_methods (kind, label) values ('PAYPAL','abrechnung@chef.ch')
         returning id`)).rows[0].id);
    expect(id).toBeDefined();

    const { rows } = await client.query(
      'select organization_id, status, is_default from payment_methods where id = $1', [id]);
    expect(rows[0].organization_id).toBe(orgId);
    // Gewaehlt, aber noch nicht autorisiert - das macht der Anbieter.
    expect(rows[0].status).toBe('PENDING');
    expect(rows[0].is_default).toBe(true);
  });

  it('laesst nur ein Standardmittel je Firma zu', async () => {
    await expect(asRole('OWNER', CHEF, async () =>
      client.query(`insert into payment_methods (kind) values ('CARD')`)))
      .rejects.toThrow(/payment_methods_one_default/);
  });

  // ROLE_DESCRIPTION: "Administrator - Keine Abrechnung."
  it('zeigt dem Administrator das Zahlungsmittel nicht', async () => {
    const seen = await asRole('ADMIN', ADMIN, async () =>
      (await client.query('select id from payment_methods')).rowCount);
    expect(seen).toBe(0);
  });

  it('laesst den Administrator keines hinterlegen', async () => {
    await expect(asRole('ADMIN', ADMIN, async () =>
      client.query(`insert into payment_methods (kind) values ('CARD')`)))
      .rejects.toThrow(/row-level security/);
  });

  it('weist eine Kartennummer im Anzeigefeld zurueck', async () => {
    await client.query('delete from payment_methods');
    await expect(asRole('OWNER', CHEF, async () =>
      client.query(
        `insert into payment_methods (kind, label) values ('CARD','4242424242424242')`)))
      .rejects.toThrow(/payment_methods_label_no_pan/);
  });

  it('nimmt einen Anzeigetext ohne Nummer an', async () => {
    const { rowCount } = await asRole('OWNER', CHEF, async () =>
      client.query(`insert into payment_methods (kind, label) values ('CARD','Visa ···· 4242')`));
    expect(rowCount).toBe(1);
  });
});
