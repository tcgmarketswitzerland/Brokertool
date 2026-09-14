import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, resetSchema } from './helpers/db';

/**
 * Der wichtigste Sicherheitstest des Projekts (Architektur 8.4).
 * Er ist bewusst generisch: eine neue Tabelle ohne Policy bricht den Build,
 * ohne dass jemand daran denken muss, den Test zu erweitern.
 */

let client: Client;

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
}, 60_000);

afterAll(async () => {
  await client?.end();
});

/** Tabellen, die absichtlich kein RLS tragen - jede Ausnahme braucht hier eine Begruendung. */
const EXEMPT: ReadonlySet<string> = new Set([]);

describe('RLS-Vollstaendigkeit', () => {
  it('jede Tabelle in public hat RLS aktiv', async () => {
    const { rows } = await client.query<{ tablename: string }>(`
      select c.relname as tablename
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    const offenders = rows.map((r) => r.tablename).filter((t) => !EXEMPT.has(t));
    expect(offenders, `Tabellen ohne RLS: ${offenders.join(', ')}`).toEqual([]);
  });

  it('jede Tabelle hat zusaetzlich FORCE RLS', async () => {
    // Ohne FORCE umgeht der Tabelleneigentuemer saemtliche Policies -
    // ein haeufig uebersehener Punkt.
    const { rows } = await client.query<{ tablename: string }>(`
      select c.relname as tablename
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and c.relrowsecurity and not c.relforcerowsecurity`);
    const offenders = rows.map((r) => r.tablename).filter((t) => !EXEMPT.has(t));
    expect(offenders, `Tabellen ohne FORCE RLS: ${offenders.join(', ')}`).toEqual([]);
  });

  it('jede Tabelle mit RLS hat mindestens eine Policy', async () => {
    const { rows } = await client.query<{ tablename: string }>(`
      select c.relname as tablename
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
         and not exists (select 1 from pg_policy p where p.polrelid = c.oid)`);
    const offenders = rows.map((r) => r.tablename).filter((t) => !EXEMPT.has(t));
    expect(offenders, `Tabellen ohne Policy: ${offenders.join(', ')}`).toEqual([]);
  });

  it('keine Tabelle hat eine nullable organization_id', async () => {
    // Datenbankstruktur 1.2: eine nullable organization_id waere eine Zeile,
    // die zu niemandem gehoert - und damit ein Loch in der Isolation.
    const { rows } = await client.query<{ tablename: string }>(`
      select c.relname as tablename
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid
       where n.nspname = 'public' and c.relkind = 'r'
         and a.attname = 'organization_id' and not a.attnotnull and not a.attisdropped`);
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });
});
