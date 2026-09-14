import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asUser, connect, resetSchema } from './helpers/db';

/**
 * Bestehende Vertraege. Bewusst schlank in der Pflicht, vollstaendig im
 * Modell (ADR-001).
 */

let client: Client;
const USER = '00000000-0000-4000-8000-00000000ca01';
const OTHER = '00000000-0000-4000-8000-00000000ca02';
let orgA = '';
let orgB = '';
let customerId = '';
let personId = '';
let hausrat = '';

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'hans@broker.ch'), ($2,'heidi@broker.ch')`,
    [USER, OTHER]);

  for (const [user, name] of [[USER, 'Hans AG'], [OTHER, 'Heidi AG']] as const) {
    await client.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({ sub: user, role: 'authenticated' })]);
    const { rows } = await client.query('select create_organization($1) as id', [name]);
    if (user === USER) orgA = rows[0].id; else orgB = rows[0].id;
  }

  customerId = (await client.query(
    `insert into customers (organization_id, customer_type) values ($1,'COUPLE') returning id`,
    [orgA])).rows[0].id;
  personId = (await client.query(
    `insert into customer_persons (organization_id, customer_id, first_name, last_name)
     values ($1,$2,'Max','Muster') returning id`, [orgA, customerId])).rows[0].id;
  hausrat = (await client.query(`select id from insurance_topics where slug='hausrat'`)).rows[0].id;
}, 60_000);

afterAll(async () => { await client?.end(); });

async function insertPolicy(fields: Record<string, unknown>) {
  const base: Record<string, unknown> = {
    organization_id: orgA, customer_id: customerId, topic_id: hausrat, ...fields,
  };
  const keys = Object.keys(base);
  return client.query(
    `insert into policies (${keys.join(', ')})
     values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    keys.map((k) => base[k]));
}

describe('Vertrag erfassen', () => {
  it('genuegt mit Versicherer und Praemie', async () => {
    // Der Kunde weiss im Gespraech meist nur das - die Police hat er nicht
    // dabei.
    const { rows } = await insertPolicy({ insurer_name: 'AXA', premium_cents: 48_000 });
    expect(rows[0].id).toBeDefined();
  });

  it('verlangt einen Versicherer, aus dem Katalog oder als Freitext', async () => {
    await expect(insertPolicy({ premium_cents: 48_000 }))
      .rejects.toThrow(/policies_needs_insurer/);
  });

  it('akzeptiert einen Versicherer aus dem Katalog', async () => {
    const mobiliar = (await client.query(
      `select id from insurers where name = 'Die Mobiliar'`)).rows[0].id;
    const { rows } = await insertPolicy({ insurer_id: mobiliar, premium_cents: 43_000 });
    expect(rows[0].id).toBeDefined();
  });

  it('weist ein Ablaufdatum vor dem Beginn zurueck', async () => {
    await expect(insertPolicy({
      insurer_name: 'AXA', start_date: '2026-01-01', end_date: '2025-12-31',
    })).rejects.toThrow(/policies_check/);
  });

  it('weist eine negative Praemie zurueck', async () => {
    await expect(insertPolicy({ insurer_name: 'AXA', premium_cents: -1 }))
      .rejects.toThrow(/premium_cents/);
  });
});

describe('Haushalt und Person', () => {
  it('ein Vertrag ohne Person gehoert dem Haushalt', async () => {
    const { rows } = await insertPolicy({ insurer_name: 'Baloise', premium_cents: 30_000 });
    const { rows: check } = await client.query(
      `select person_id from policies where id = $1`, [rows[0].id]);
    expect(check[0].person_id).toBeNull();
  });

  it('ein Vertrag kann einer Person zugeordnet werden', async () => {
    const { rows } = await insertPolicy({
      insurer_name: 'Swiss Life', premium_cents: 120_000, person_id: personId,
    });
    const { rows: check } = await client.query(
      `select person_id from policies where id = $1`, [rows[0].id]);
    expect(check[0].person_id).toBe(personId);
  });

  it('beim Entfernen einer Person bleibt der Vertrag erhalten', async () => {
    // Sonst verschwaende mit der Person auch die Vertragshistorie, die im
    // Protokoll nachvollziehbar bleiben muss.
    const p = (await client.query(
      `insert into customer_persons (organization_id, customer_id, person_role, first_name, last_name)
       values ($1,$2,'PARTNER','Anna','Muster') returning id`, [orgA, customerId])).rows[0].id;
    const policy = (await insertPolicy({
      insurer_name: 'Helvetia', premium_cents: 20_000, person_id: p })).rows[0].id;

    await client.query(`delete from customer_persons where id = $1`, [p]);

    const { rows } = await client.query(
      `select person_id from policies where id = $1`, [policy]);
    expect(rows).toHaveLength(1);
    expect(rows[0].person_id).toBeNull();
  });
});

describe('Dokumente', () => {
  it('brauchen mindestens einen Bezug', async () => {
    await expect(client.query(
      `insert into documents (organization_id, kind, storage_path, original_filename, mime_type, size_bytes)
       values ($1,'POLICY','a/b/c.pdf','police.pdf','application/pdf',1000)`, [orgA]),
    ).rejects.toThrow(/documents_check/);
  });

  it('weisen eine zu grosse Datei zurueck', async () => {
    await expect(client.query(
      `insert into documents (organization_id, customer_id, kind, storage_path,
                              original_filename, mime_type, size_bytes)
       values ($1,$2,'POLICY','a/b/gross.pdf','gross.pdf','application/pdf', 20971521)`,
      [orgA, customerId]),
    ).rejects.toThrow(/size_bytes/);
  });

  it('derselbe Speicherpfad kommt nur einmal vor', async () => {
    const insert = () => client.query(
      `insert into documents (organization_id, customer_id, kind, storage_path,
                              original_filename, mime_type, size_bytes)
       values ($1,$2,'POLICY','org/kunde/eindeutig.pdf','police.pdf','application/pdf',1000)`,
      [orgA, customerId]);
    await insert();
    await expect(insert()).rejects.toThrow(/storage_path/);
  });
});

describe('Mandantentrennung bei Vertraegen', () => {
  it('ein fremder Broker sieht die Vertraege nicht', async () => {
    const rows = await asUser(client, { userId: OTHER, organizationId: orgB, role: 'OWNER' },
      async () => (await client.query('select id from policies')).rows);
    expect(rows).toEqual([]);
  });

  it('das Backoffice darf Vertraege pflegen', async () => {
    // Konzeptpunkt 20: es pflegt nach, fuehrt aber keine Beratung.
    const { rows } = await client.query(
      `select set_config('request.jwt.claims', $1, false) is not null as _,
              can_write('policies') as vertraege, can_write('advice_sessions') as beratung`,
      [JSON.stringify({ app_metadata: { organization_role: 'BACKOFFICE' } })]);
    expect(rows[0].vertraege).toBe(true);
    expect(rows[0].beratung).toBe(false);
  });
});

describe('Versichererkatalog', () => {
  it('enthaelt die grossen Schweizer Anbieter', async () => {
    const { rows } = await client.query(`select name from insurers where is_active`);
    const namen = rows.map((r) => r.name);
    for (const erwartet of ['AXA', 'Die Mobiliar', 'Helvetia', 'Zurich', 'CSS']) {
      expect(namen, erwartet).toContain(erwartet);
    }
  });

  it('ist lesbar, aber nicht beschreibbar', async () => {
    const res = await asUser(client, { userId: USER, organizationId: orgA, role: 'OWNER' },
      () => client.query(`update insurers set is_active = false`));
    expect(res.rowCount).toBe(0);
  });
});
