import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const STUB = join(process.cwd(), 'tests', 'db', 'helpers', 'supabase-stub.sql');

export const connectionString =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/brokertool_test';

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

/** Schema von Null aufbauen: Stub, dann alle Migrationen in Reihenfolge. */
export async function resetSchema(client: Client): Promise<void> {
  await client.query('drop schema if exists public cascade');
  await client.query('drop schema if exists auth cascade');
  await client.query('create schema public');
  await client.query(readFileSync(STUB, 'utf8'));

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await client.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  await client.query('select public.apply_tenant_rls()');
  await client.query(
    'grant select, insert, update, delete on all tables in schema public to authenticated',
  );
}

/**
 * Die JWT-Claims, wie der Access-Token-Hook sie setzt - member_id
 * eingeschlossen.
 *
 * Seit Migration 0026 haengt die Sichtbarkeit eines Kunden daran. Fehlt
 * der Claim, sieht ein Berater nichts - und der Test scheitert an einer
 * Policy statt an der Sache, die er pruefen wollte.
 */
export async function claimsFor(
  client: Client, orgId: string, role: string, userId: string,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    'select id from organization_members where organization_id = $1 and user_id = $2',
    [orgId, userId]);
  const memberId = rows[0]?.id;
  return JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: {
      organization_id: orgId,
      organization_role: role,
      ...(memberId ? { member_id: memberId } : {}),
    },
  });
}

export type Actor = { userId: string; organizationId: string; role: string };

/**
 * Fuehrt Anweisungen als angemeldeter Nutzer aus: Rolle 'authenticated'
 * plus JWT-Claims. Genau so arbeitet PostgREST, deshalb pruefen die Tests
 * damit die echten Policies und keine Nachbildung.
 */
export async function asUser<T>(
  client: Client,
  actor: Actor,
  fn: () => Promise<T>,
): Promise<T> {
  const claims = await claimsFor(client, actor.organizationId, actor.role, actor.userId);
  await client.query('begin');
  await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await client.query('set local role authenticated');
  try {
    return await fn();
  } finally {
    await client.query('rollback');
  }
}

/** Tabellen mit organization_id - die Klasse A aus Datenbankstruktur 1.2. */
export async function tenantTables(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ tbl: string }>(`
    select c.relname as tbl
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      join pg_attribute a  on a.attrelid = c.oid
     where ns.nspname = 'public' and c.relkind = 'r'
       and a.attname = 'organization_id' and a.attnum > 0 and not a.attisdropped
     order by 1`);
  return rows.map((r) => r.tbl);
}
