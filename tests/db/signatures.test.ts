import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, resetSchema } from './helpers/db';

/**
 * Unterschriften.
 *
 * Sie liegen in der eigenen Tabelle und nicht im Objektspeicher
 * (Begruendung in Migration 0020). Damit gelten dieselben Mandantenregeln
 * wie fuer alles andere - und genau das wird hier geprueft.
 */

let client: Client;
const A = '00000000-0000-4000-8000-0000000051a1';
const B = '00000000-0000-4000-8000-0000000051a2';
let orgA = '';
let orgB = '';
let sessionA = '';
let snapshotA = '';

const IMAGE = 'iVBORw0KGgo'.repeat(20);

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
  await client.query(
    `insert into auth.users (id, email) values ($1,'sia@broker.ch'), ($2,'sib@broker.ch')`,
    [A, B]);

  for (const [user, name] of [[A, 'Sia AG'], [B, 'Sib AG']] as const) {
    await client.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({ sub: user, role: 'authenticated' })]);
    const { rows } = await client.query('select create_organization($1) as id', [name]);
    if (user === A) orgA = rows[0].id; else orgB = rows[0].id;
  }

  const customer = (await client.query(
    `insert into customers (organization_id, customer_type) values ($1,'PRIVATE') returning id`,
    [orgA])).rows[0].id;
  await client.query(
    `insert into customer_persons (organization_id, customer_id, person_role, first_name, last_name)
     values ($1,$2,'PRIMARY','Max','Muster')`, [orgA, customer]);

  sessionA = await asRole(orgA, 'ADVISOR', A, async () =>
    (await client.query('select start_advice_session($1) as id', [customer])).rows[0].id);
  await client.query(
    `update advice_session_topics
        set progress_status='DISCUSSED', outcome='NO_ACTION_NEEDED', discussed_at=now()
      where session_id = $1`, [sessionA]);
  snapshotA = await asRole(orgA, 'ADVISOR', A, async () =>
    (await client.query('select complete_advice_session($1, $2::jsonb) as id',
      [sessionA, JSON.stringify({ schemaVersion: 1 })])).rows[0].id);
}, 60_000);

afterAll(async () => { await client?.end(); });

function sign(fields: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    session_id: sessionA, snapshot_id: snapshotA,
    signer_name: 'Max Muster', image_base64: IMAGE, ...fields,
  };
  const keys = Object.keys(base);
  return client.query(
    `insert into signatures (${keys.join(', ')})
     values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning id, organization_id`,
    keys.map((k) => base[k]));
}

describe('Unterschrift erfassen', () => {
  it('nimmt die Unterschrift des Beraters an', async () => {
    const { rows } = await asRole(orgA, 'ADVISOR', A, () => sign());
    // Die Mandantenkennung setzt der Vorgabewert - nie der Aufrufer.
    expect(rows[0].organization_id).toBe(orgA);
  });

  it('laesst das Backoffice nicht unterschreiben', async () => {
    await expect(asRole(orgA, 'BACKOFFICE', A, () => sign()))
      .rejects.toThrow(/row-level security/);
  });

  it('weist ein leeres Bild zurueck', async () => {
    await expect(asRole(orgA, 'ADVISOR', A, () => sign({ image_base64: 'x' })))
      .rejects.toThrow(/signatures_image_base64_check/);
  });

  it('weist einen unbekannten Dateityp zurueck', async () => {
    await expect(asRole(orgA, 'ADVISOR', A, () => sign({ content_type: 'application/pdf' })))
      .rejects.toThrow(/signatures_content_type_check/);
  });

  it('verlangt einen Snapshot - eine Unterschrift ohne Protokoll belegt nichts', async () => {
    await expect(asRole(orgA, 'ADVISOR', A, () => sign({ snapshot_id: null })))
      .rejects.toThrow(/null value|not-null/);
  });
});

describe('Mandantentrennung', () => {
  it('zeigt einer anderen Firma die Unterschrift nicht', async () => {
    const { rows } = await asRole(orgB, 'OWNER', B, () =>
      client.query('select id from signatures'));
    expect(rows).toHaveLength(0);
  });

  it('zeigt der eigenen Firma ihre Unterschriften', async () => {
    const { rows } = await asRole(orgA, 'OWNER', A, () =>
      client.query('select id from signatures'));
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('Unveraenderlich', () => {
  it('laesst eine Unterschrift nicht aendern', async () => {
    // Eine Unterschrift, die sich ueberschreiben laesst, belegt nichts.
    const { rowCount } = await asRole(orgA, 'OWNER', A, () =>
      client.query(`update signatures set signer_name = 'Jemand anders'`));
    expect(rowCount).toBe(0);
  });

  it('laesst eine Unterschrift nicht loeschen', async () => {
    const { rowCount } = await asRole(orgA, 'OWNER', A, () =>
      client.query('delete from signatures'));
    expect(rowCount).toBe(0);
  });

  it('haelt den Snapshot fest, solange eine Unterschrift daran haengt', async () => {
    await expect(client.query('delete from advice_session_snapshots where id = $1', [snapshotA]))
      .rejects.toThrow(/violates foreign key/);
  });
});
