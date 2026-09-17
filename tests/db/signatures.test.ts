import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, resetSchema } from './helpers/db';

/**
 * Unterschriften: Tabelle und Ablage.
 *
 * Der Pfad im Speicher traegt die Mandantenkennung als erstes Segment -
 * storage.objects hat keine organization_id, und ohne diese Pruefung
 * koennte jede angemeldete Person die Unterschriften jeder anderen Firma
 * herunterladen.
 */

let client: Client;
const A = '00000000-0000-4000-8000-0000000051a1';
const B = '00000000-0000-4000-8000-0000000051a2';
let orgA = '';
let orgB = '';

async function asRole<T>(
  orgId: string, role: string, userId: string, fn: () => Promise<T>,
): Promise<T> {
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({
      sub: userId, role: 'authenticated',
      app_metadata: { organization_id: orgId, organization_role: role },
    })]);
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
  await client.query('delete from storage.objects');
  await client.query(
    `insert into auth.users (id, email) values ($1,'sia@broker.ch'), ($2,'sib@broker.ch')`,
    [A, B]);

  for (const [user, name] of [[A, 'Sia AG'], [B, 'Sib AG']] as const) {
    await client.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({ sub: user, role: 'authenticated' })]);
    const { rows } = await client.query('select create_organization($1) as id', [name]);
    if (user === A) orgA = rows[0].id; else orgB = rows[0].id;
  }
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Ablage der Unterschrift', () => {
  it('nimmt eine Datei im eigenen Mandantenordner an', async () => {
    const id = await asRole(orgA, 'ADVISOR', A, async () =>
      (await client.query(
        `insert into storage.objects (bucket_id, name) values ('signatures', $1) returning id`,
        [`${orgA}/session-1/kunde.png`])).rows[0].id);
    expect(id).toBeDefined();
  });

  it('weist eine Datei im Ordner einer anderen Firma zurueck', async () => {
    await expect(asRole(orgA, 'ADVISOR', A, () => client.query(
      `insert into storage.objects (bucket_id, name) values ('signatures', $1)`,
      [`${orgB}/session-1/kunde.png`])))
      .rejects.toThrow(/row-level security/);
  });

  it('weist eine Datei ohne Mandantenordner zurueck', async () => {
    await expect(asRole(orgA, 'ADVISOR', A, () => client.query(
      `insert into storage.objects (bucket_id, name) values ('signatures', 'kunde.png')`)))
      .rejects.toThrow(/row-level security/);
  });

  it('laesst das Backoffice nicht unterschreiben', async () => {
    await expect(asRole(orgA, 'BACKOFFICE', A, () => client.query(
      `insert into storage.objects (bucket_id, name) values ('signatures', $1)`,
      [`${orgA}/session-2/kunde.png`])))
      .rejects.toThrow(/row-level security/);
  });

  it('zeigt einer anderen Firma die Unterschrift nicht', async () => {
    const { rows } = await asRole(orgB, 'OWNER', B, () =>
      client.query(`select name from storage.objects where bucket_id = 'signatures'`));
    expect(rows).toHaveLength(0);
  });

  it('zeigt der eigenen Firma ihre Unterschriften', async () => {
    const { rows } = await asRole(orgA, 'OWNER', A, () =>
      client.query(`select name from storage.objects where bucket_id = 'signatures'`));
    expect(rows).toHaveLength(1);
  });

  it('laesst eine abgelegte Unterschrift nicht ueberschreiben', async () => {
    // Eine Unterschrift, die sich aendern laesst, belegt nichts.
    const { rowCount } = await asRole(orgA, 'ADVISOR', A, () =>
      client.query(
        `update storage.objects set name = $1 where bucket_id = 'signatures'`,
        [`${orgA}/session-1/anders.png`]));
    expect(rowCount).toBe(0);
  });

  it('laesst eine abgelegte Unterschrift nicht loeschen', async () => {
    const { rowCount } = await asRole(orgA, 'ADVISOR', A, () =>
      client.query(`delete from storage.objects where bucket_id = 'signatures'`));
    expect(rowCount).toBe(0);
  });
});
