import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asUser, connect, resetSchema, tenantTables } from './helpers/db';

/**
 * Isolationsnachweis (Architektur 8.4, Konzeptpunkt 19).
 * Zwei echte Nutzer in zwei Organisationen versuchen kreuzweise zuzugreifen.
 * Der Test laeuft ueber jede Mandantentabelle, die es gibt - er waechst also
 * automatisch mit dem Schema mit.
 */

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';
const USER_A = '00000000-0000-4000-8000-0000000000a1';
const USER_B = '00000000-0000-4000-8000-0000000000b1';

let client: Client;
let tables: string[];

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);

  await client.query(`insert into auth.users (id, email) values ($1,'a@test.ch'), ($2,'b@test.ch')`,
    [USER_A, USER_B]);
  await client.query(
    `insert into organizations (id, name, slug) values ($1,'Broker A','broker-a'), ($2,'Broker B','broker-b')`,
    [ORG_A, ORG_B]);

  tables = await tenantTables(client);
}, 60_000);

afterAll(async () => {
  await client?.end();
});

describe('Mandantentrennung', () => {
  it('Nutzer B sieht die Organisation von A nicht', async () => {
    const rows = await asUser(client, { userId: USER_B, organizationId: ORG_B, role: 'OWNER' },
      async () => (await client.query('select id from organizations')).rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(ORG_B);
  });

  it('Nutzer B kann die Organisation von A nicht aendern', async () => {
    const res = await asUser(client, { userId: USER_B, organizationId: ORG_B, role: 'OWNER' },
      () => client.query(`update organizations set name = 'uebernommen' where id = $1`, [ORG_A]));
    expect(res.rowCount).toBe(0);
  });

  it('ohne JWT ist nichts sichtbar', async () => {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims', '', true)`);
    await client.query('set local role authenticated');
    const { rows } = await client.query('select id from organizations');
    await client.query('rollback');
    expect(rows).toEqual([]);
  });

  it('kein Lesezugriff auf fremde Zeilen in irgendeiner Mandantentabelle', async () => {
    for (const table of tables) {
      const rows = await asUser(client, { userId: USER_B, organizationId: ORG_B, role: 'OWNER' },
        async () => (await client.query(
          `select 1 from public."${table}" where organization_id = $1 limit 1`, [ORG_A])).rows);
      expect(rows, `${table}: fremde Zeilen sichtbar`).toEqual([]);
    }
  });

  it('kein Schreibzugriff mit fremder organization_id', async () => {
    for (const table of tables) {
      await expect(
        asUser(client, { userId: USER_B, organizationId: ORG_B, role: 'OWNER' }, async () => {
          // Spaltenvorgaben greifen; der Insert muss an der WITH-CHECK-Policy
          // scheitern, nicht an fehlenden Pflichtfeldern.
          await client.query(
            `insert into public."${table}" (organization_id) values ($1)`, [ORG_A]);
        }),
        `${table}: Insert mit fremder organization_id wurde akzeptiert`,
      ).rejects.toThrow();
    }
  });

  it('organization_id wird beim Insert aus dem JWT gesetzt, nicht vom Client', async () => {
    // Regel R5 (Architektur 1): der Spalten-Default macht es unmoeglich,
    // versehentlich in einen fremden Mandanten zu schreiben.
    for (const table of tables) {
      const { rows } = await client.query<{ default_expr: string | null }>(`
        select pg_get_expr(d.adbin, d.adrelid) as default_expr
          from pg_attribute a
          join pg_class c on c.oid = a.attrelid
          join pg_namespace n on n.oid = c.relnamespace
          left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
         where n.nspname = 'public' and c.relname = $1 and a.attname = 'organization_id'`,
        [table]);
      expect(rows[0]?.default_expr, `${table}: kein Default auf organization_id`)
        .toContain('auth_org_id');
    }
  });
});
