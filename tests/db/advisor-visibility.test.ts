import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { claimsFor, connect, resetSchema } from './helpers/db';

/**
 * Berateransicht (Migration 0026).
 *
 * Der Kern des Ganzen: zwei Berater derselben Firma duerfen einander
 * nicht ueber die Schulter sehen, die Firmenleitung sieht beide. Geprueft
 * wird gegen die echten Policies mit echten JWT-Claims - eine Nachbildung
 * in TypeScript wuerde genau den Fehler nicht finden, um den es geht.
 */

let client: Client;
const CHEF = '00000000-0000-4000-8000-00000000be01';
const ANNA = '00000000-0000-4000-8000-00000000be02';
const BENT = '00000000-0000-4000-8000-00000000be03';

let orgId = '';
let annaMember = '';
let bentMember = '';
let annaCustomer = '';
let bentCustomer = '';
let annaSession = '';

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

async function addMember(userId: string, role: string): Promise<string> {
  const { rows } = await client.query(
    `insert into organization_members
       (organization_id, user_id, role, display_name, email)
     values ($1,$2,$3,$4,$5) returning id`,
    [orgId, userId, role, userId.slice(-4), `${userId.slice(-4)}@broker.ch`]);
  return rows[0].id;
}

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email)
     values ($1,'chef@broker.ch'), ($2,'anna@broker.ch'), ($3,'bent@broker.ch')`,
    [CHEF, ANNA, BENT]);

  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: CHEF, role: 'authenticated' })]);
  orgId = (await client.query('select create_organization($1) as id', ['Chef AG'])).rows[0].id;

  annaMember = await addMember(ANNA, 'ADVISOR');
  bentMember = await addMember(BENT, 'ADVISOR');

  // Jeder Berater legt seinen eigenen Kunden an - der Vorgabewert auf
  // primary_advisor_id soll dabei aus dem JWT kommen.
  annaCustomer = await asRole('ADVISOR', ANNA, async () =>
    (await client.query(
      `insert into customers (customer_type) values ('PRIVATE') returning id`)).rows[0].id);
  bentCustomer = await asRole('ADVISOR', BENT, async () =>
    (await client.query(
      `insert into customers (customer_type) values ('PRIVATE') returning id`)).rows[0].id);

  await client.query(
    `insert into customer_persons (organization_id, customer_id, person_role, first_name, last_name)
     values ($1,$2,'PRIMARY','Max','Muster')`, [orgId, annaCustomer]);

  annaSession = await asRole('ADVISOR', ANNA, async () =>
    (await client.query('select start_advice_session($1) as id', [annaCustomer])).rows[0].id);
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Zustaendigkeit', () => {
  it('traegt den anlegenden Berater als zustaendig ein', async () => {
    const { rows } = await client.query(
      'select primary_advisor_id from customers where id = $1', [annaCustomer]);
    expect(rows[0].primary_advisor_id).toBe(annaMember);
  });
});

describe('Berater sieht nur die eigenen Kunden', () => {
  it('zeigt Anna ihren Kunden', async () => {
    const rows = await asRole('ADVISOR', ANNA, async () =>
      (await client.query('select id from customers where id = $1', [annaCustomer])).rowCount);
    expect(rows).toBe(1);
  });

  it('zeigt Anna den Kunden von Bent nicht', async () => {
    const rows = await asRole('ADVISOR', ANNA, async () =>
      (await client.query('select id from customers where id = $1', [bentCustomer])).rowCount);
    expect(rows).toBe(0);
  });

  it('zeigt Bent die Beratung von Anna nicht', async () => {
    const rows = await asRole('ADVISOR', BENT, async () =>
      (await client.query('select id from advice_sessions where id = $1', [annaSession])).rowCount);
    expect(rows).toBe(0);
  });

  // Der eigentliche Zweck: was am fremden Kunden haengt, haengt mit.
  it('zeigt Bent weder Personen noch Themen des fremden Kunden', async () => {
    const seen = await asRole('ADVISOR', BENT, async () => ({
      persons: (await client.query(
        'select id from customer_persons where customer_id = $1', [annaCustomer])).rowCount,
      topics: (await client.query(
        'select id from advice_session_topics where session_id = $1', [annaSession])).rowCount,
    }));
    expect(seen.persons).toBe(0);
    expect(seen.topics).toBe(0);
  });

  it('laesst Bent keine Notiz an einer fremden Beratung anlegen', async () => {
    await expect(asRole('ADVISOR', BENT, async () =>
      client.query(
        `insert into notes (session_id, visibility, body)
         values ($1,'SHARED','fremd')`, [annaSession])))
      .rejects.toThrow(/row-level security/);
  });

  /**
   * Die Luecke aus 0026, geschlossen in 0030.
   *
   * Eine Notiz traegt genau einen Bezug. Im haeufigsten Fall - der Notiz
   * zu einer Sparte - ist das session_topic_id; customer_id und
   * session_id stehen dann auf NULL, und die Bedingung von 0026 war
   * erfuellt, ohne etwas zu pruefen. Ausgerechnet bei Notizen, in denen
   * steht, was im Gespraech gesagt wurde.
   */
  it('zeigt Bent die Spartennotiz einer fremden Beratung nicht', async () => {
    const topicId = (await client.query(
      'select id from advice_session_topics where session_id = $1 limit 1',
      [annaSession])).rows[0].id;

    await asRole('ADVISOR', ANNA, async () =>
      client.query(
        `insert into notes (session_topic_id, visibility, body)
         values ($1,'SHARED','Kunde erwaehnte eine Scheidung.')`, [topicId]));

    const seen = await asRole('ADVISOR', BENT, async () =>
      (await client.query('select id from notes where session_topic_id = $1',
        [topicId])).rowCount);
    expect(seen).toBe(0);

    const mine = await asRole('ADVISOR', ANNA, async () =>
      (await client.query('select id from notes where session_topic_id = $1',
        [topicId])).rowCount);
    expect(mine).toBe(1);
  });

  it('laesst Bent keine Spartennotiz in einer fremden Beratung anlegen', async () => {
    const topicId = (await client.query(
      'select id from advice_session_topics where session_id = $1 limit 1',
      [annaSession])).rows[0].id;

    await expect(asRole('ADVISOR', BENT, async () =>
      client.query(
        `insert into notes (session_topic_id, visibility, body)
         values ($1,'SHARED','fremd')`, [topicId])))
      .rejects.toThrow(/row-level security/);
  });

  it('laesst Bent den fremden Kunden nicht an sich ziehen', async () => {
    const rows = await asRole('ADVISOR', BENT, async () =>
      (await client.query(
        'update customers set primary_advisor_id = $1 where id = $2',
        [bentMember, annaCustomer])).rowCount);
    expect(rows).toBe(0);
  });
});

describe('Firmenleitung sieht alles', () => {
  it('zeigt dem Chef beide Kunden und die Beratung', async () => {
    const seen = await asRole('OWNER', CHEF, async () => ({
      customers: (await client.query(
        'select id from customers where id = any($1::uuid[])',
        [[annaCustomer, bentCustomer]])).rowCount,
      sessions: (await client.query(
        'select id from advice_sessions where id = $1', [annaSession])).rowCount,
    }));
    expect(seen.customers).toBe(2);
    expect(seen.sessions).toBe(1);
  });

  it('nennt dem Chef den zustaendigen Berater', async () => {
    const { rows } = await asRole('OWNER', CHEF, async () =>
      client.query(
        `select m.display_name
           from customers c join organization_members m on m.id = c.primary_advisor_id
          where c.id = $1`, [annaCustomer]));
    expect(rows[0]?.display_name).toBe(ANNA.slice(-4));
  });

  // Backoffice pflegt fremde Faelle nach; ohne Vollsicht saehe es nichts.
  it('zeigt dem Backoffice ebenfalls beide Kunden', async () => {
    const seen = await asRole('BACKOFFICE', CHEF, async () =>
      (await client.query('select id from customers where id = any($1::uuid[])',
        [[annaCustomer, bentCustomer]])).rowCount);
    expect(seen).toBe(2);
  });
});
