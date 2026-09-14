import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, resetSchema } from './helpers/db';

/**
 * Abschluss, Snapshot und Unveraenderlichkeit (Konzeptpunkt 29).
 *
 * Der wichtigste Test im System: er prueft das Versprechen "kein Bereich
 * wird vergessen" dort, wo es nicht umgangen werden kann - in der
 * Datenbank. Eine Regel, die nur in der Oberflaeche steht, faellt beim
 * ersten direkten Aufruf.
 */

let client: Client;
const ADVISOR = '00000000-0000-4000-8000-00000000ce11';
const BACKOFFICE = '00000000-0000-4000-8000-00000000ce22';
let orgId = '';
let customerId = '';

async function asRole<T>(role: string, userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({
      sub: userId,
      app_metadata: { organization_id: orgId, organization_role: role },
    })]);
  return fn();
}

async function newSession(): Promise<string> {
  return asRole('ADVISOR', ADVISOR, async () =>
    (await client.query('select start_advice_session($1) as id', [customerId])).rows[0].id);
}

/** Alle Pflichtthemen mit einem Ergebnis versehen. */
async function settleAll(sessionId: string, outcome = 'NO_ACTION_NEEDED'): Promise<void> {
  await client.query(
    `update advice_session_topics
        set progress_status = 'DISCUSSED', outcome = $2::topic_outcome,
            discussed_at = now()
      where session_id = $1`, [sessionId, outcome]);
}

const DOC = { schemaVersion: 1, customerName: 'Max Muster', topics: [] };

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'cem@broker.ch'), ($2,'cora@broker.ch')`,
    [ADVISOR, BACKOFFICE]);

  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: ADVISOR, role: 'authenticated' })]);
  orgId = (await client.query('select create_organization($1) as id', ['Cem AG'])).rows[0].id;
  await client.query(
    `insert into organization_members (organization_id, user_id, role, display_name, email)
     values ($1,$2,'BACKOFFICE','Cora','cora@broker.ch')`, [orgId, BACKOFFICE]);

  customerId = (await client.query(
    `insert into customers (organization_id, customer_type) values ($1,'PRIVATE') returning id`,
    [orgId])).rows[0].id;
  await client.query(
    `insert into customer_persons (organization_id, customer_id, person_role, first_name, last_name)
     values ($1,$2,'PRIMARY','Max','Muster')`, [orgId, customerId]);
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Abschluss verlangt ein Ergebnis je Pflichtsparte', () => {
  it('verweigert den Abschluss, solange Pflichtsparten offen sind', async () => {
    const sessionId = await newSession();
    await expect(asRole('ADVISOR', ADVISOR, () =>
      client.query('select complete_advice_session($1, $2::jsonb) as id',
        [sessionId, JSON.stringify(DOC)])))
      .rejects.toThrow(/Pflichtbereiche offen/);
  });

  it('nennt die Zahl der offenen Pflichtsparten', async () => {
    // Elf Pflichtsparten, eine davon besprochen - es muessen zehn bleiben.
    const sessionId = await newSession();
    await client.query(
      `update advice_session_topics
          set progress_status='DISCUSSED', outcome='NO_ACTION_NEEDED', discussed_at=now()
        where id = (select id from advice_session_topics where session_id = $1
                     order by display_order limit 1)`, [sessionId]);
    await expect(asRole('ADVISOR', ADVISOR, () =>
      client.query('select complete_advice_session($1, $2::jsonb)',
        [sessionId, JSON.stringify(DOC)])))
      .rejects.toThrow(/noch 10 Pflichtbereiche/);
  });

  it('laesst eine ausdruecklich uebersprungene Sparte durchgehen', async () => {
    // Uebersprungen ist eine bewusste Entscheidung des Beraters und damit
    // etwas anderes als "vergessen". Im Protokoll steht sie als solche.
    const sessionId = await newSession();
    await settleAll(sessionId);
    await client.query(
      `update advice_session_topics set progress_status='SKIPPED', outcome=null
        where session_id = $1 and display_order = 1`, [sessionId]);

    const id = await asRole('ADVISOR', ADVISOR, async () =>
      (await client.query('select complete_advice_session($1, $2::jsonb) as id',
        [sessionId, JSON.stringify(DOC)])).rows[0].id);
    expect(id).toBeDefined();
  });

  it('schliesst ab, wenn alle Pflichtsparten ein Ergebnis haben', async () => {
    const sessionId = await newSession();
    await settleAll(sessionId);
    await asRole('ADVISOR', ADVISOR, () =>
      client.query('select complete_advice_session($1, $2::jsonb)',
        [sessionId, JSON.stringify(DOC)]));

    const { rows } = await client.query(
      'select status, completed_at from advice_sessions where id = $1', [sessionId]);
    expect(rows[0].status).toBe('COMPLETED');
    expect(rows[0].completed_at).not.toBeNull();
  });
});

describe('Snapshot', () => {
  it('friert das Dokument mit Hash ein', async () => {
    const sessionId = await newSession();
    await settleAll(sessionId);
    const snapshotId = await asRole('ADVISOR', ADVISOR, async () =>
      (await client.query('select complete_advice_session($1, $2::jsonb) as id',
        [sessionId, JSON.stringify(DOC)])).rows[0].id);

    const { rows } = await client.query(
      'select document, content_hash from advice_session_snapshots where id = $1', [snapshotId]);
    expect(rows[0].document.customerName).toBe('Max Muster');
    expect(rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('laesst je Beratung nur einen Snapshot zu', async () => {
    const sessionId = await newSession();
    await settleAll(sessionId);
    await asRole('ADVISOR', ADVISOR, () =>
      client.query('select complete_advice_session($1, $2::jsonb)',
        [sessionId, JSON.stringify(DOC)]));

    await expect(asRole('ADVISOR', ADVISOR, () =>
      client.query('select complete_advice_session($1, $2::jsonb)',
        [sessionId, JSON.stringify(DOC)])))
      .rejects.toThrow(/nicht gefunden oder bereits abgeschlossen/);
  });
});

describe('Eine abgeschlossene Beratung ist unveraenderlich', () => {
  let closed = '';

  beforeAll(async () => {
    closed = await newSession();
    await client.query(
      `insert into notes (organization_id, session_id, visibility, body)
       values ($1,$2,'SHARED','Im Gespraech festgehalten')`, [orgId, closed]);
    await settleAll(closed);
    await asRole('ADVISOR', ADVISOR, () =>
      client.query('select complete_advice_session($1, $2::jsonb)',
        [closed, JSON.stringify(DOC)]));
  });

  it('verweigert Aenderungen an der Beratung selbst', async () => {
    await expect(client.query(
      `update advice_sessions set location = 'Bern' where id = $1`, [closed]))
      .rejects.toThrow(/unveraenderlich/);
  });

  it('verweigert Aenderungen an den Sparten', async () => {
    await expect(client.query(
      `update advice_session_topics set outcome = 'OFFER_REQUESTED' where session_id = $1`,
      [closed])).rejects.toThrow(/unveraenderlich/);
  });

  it('verweigert Aenderungen an den Notizen', async () => {
    await expect(client.query(`update notes set body = 'Neu' where session_id = $1`, [closed]))
      .rejects.toThrow(/unveraenderlich/);
  });

  it('verweigert eine nachtraeglich eingefuegte Notiz', async () => {
    // Sonst liesse sich die Aussage einer abgeschlossenen Beratung
    // nachtraeglich ergaenzen, ohne eine einzige Zeile zu aendern.
    await expect(client.query(
      `insert into notes (organization_id, session_id, visibility, body)
       values ($1,$2,'SHARED','Nachtraeglich')`, [orgId, closed]))
      .rejects.toThrow(/unveraenderlich/);
  });
});

describe('Berechtigungen', () => {
  it('laesst das Backoffice nicht abschliessen', async () => {
    // Abschluss ist eine Beratungshandlung mit Haftungsfolge - sie gehoert
    // dem Berater, der das Gespraech gefuehrt hat.
    const sessionId = await newSession();
    await settleAll(sessionId);
    await expect(asRole('BACKOFFICE', BACKOFFICE, () =>
      client.query('select complete_advice_session($1, $2::jsonb)',
        [sessionId, JSON.stringify(DOC)])))
      .rejects.toThrow(/Berechtigung|nicht gefunden/);
  });

  it('erreicht keine Beratung einer anderen Firma', async () => {
    const sessionId = await newSession();
    await settleAll(sessionId);
    await expect(asRole('OWNER', ADVISOR, () =>
      client.query('select complete_advice_session($1, $2::jsonb)',
        [sessionId, JSON.stringify(DOC)]).then(async () => {
          await client.query("select set_config('request.jwt.claims', $1, false)",
            [JSON.stringify({
              sub: ADVISOR,
              app_metadata: {
                organization_id: '00000000-0000-4000-8000-0000000000ff',
                organization_role: 'OWNER',
              },
            })]);
          return client.query('select complete_advice_session($1, $2::jsonb)',
            [sessionId, JSON.stringify(DOC)]);
        })))
      .rejects.toThrow(/nicht gefunden oder bereits abgeschlossen/);
  });
});
