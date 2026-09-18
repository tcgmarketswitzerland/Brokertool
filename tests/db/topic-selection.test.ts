import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { claimsFor, connect, resetSchema } from './helpers/db';

/**
 * Spartenauswahl je Firma (Migration 0028).
 *
 * Der Kern ist nicht die Auswahl, sondern der Zeitpunkt: eine laufende
 * Beratung behaelt ihre Vorlagenversion. Wer die Auswahl aendert, waehrend
 * ein Gespraech laeuft, darf dessen Bewertung nicht nachtraeglich
 * verschieben.
 */

let client: Client;
const CHEF = '00000000-0000-4000-8000-00000000c501';
const ANNA = '00000000-0000-4000-8000-00000000c502';
let orgId = '';
let customerId = '';
let topics: { id: string; slug: string }[] = [];

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

/** Die Auswahl in der Form, die publish_topic_selection erwartet. */
function selection(entries: { slug: string; enabled?: boolean; required?: boolean }[]) {
  return JSON.stringify(entries.map((e) => {
    const topic = topics.find((t) => t.slug === e.slug);
    if (!topic) throw new Error(`Sparte ${e.slug} gibt es nicht`);
    return {
      topic_id: topic.id,
      is_enabled: e.enabled ?? true,
      is_required: e.required ?? false,
    };
  }));
}

async function publishedTopics(): Promise<{ slug: string; required: boolean; order: number }[]> {
  const { rows } = await client.query(`
    select t.slug, tt.is_required, tt.display_order
      from advice_template_topics tt
      join advice_template_versions v on v.id = tt.template_version_id
      join advice_templates tpl on tpl.id = v.template_id
      join insurance_topics t on t.id = tt.topic_id
     where tpl.organization_id = $1 and tpl.is_default and v.status = 'PUBLISHED'
       and v.version = (select max(v2.version) from advice_template_versions v2
                         where v2.template_id = tpl.id and v2.status = 'PUBLISHED')
     order by tt.display_order`, [orgId]);
  return rows.map((r) => ({
    slug: String(r.slug), required: r.is_required === true, order: Number(r.display_order),
  }));
}

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'chef@broker.ch'), ($2,'anna@broker.ch')`,
    [CHEF, ANNA]);
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: CHEF, role: 'authenticated' })]);
  orgId = (await client.query('select create_organization($1) as id', ['Chef AG'])).rows[0].id;
  await client.query(
    `insert into organization_members (organization_id, user_id, role, display_name, email)
     values ($1,$2,'ADVISOR','Anna','anna@broker.ch')`, [orgId, ANNA]);

  topics = (await client.query(
    'select id, slug from insurance_topics where is_active order by display_order')).rows;

  customerId = await asRole('ADVISOR', ANNA, async () =>
    (await client.query(
      `insert into customers (customer_type) values ('PRIVATE') returning id`)).rows[0].id);
  await client.query(
    `insert into customer_persons (organization_id, customer_id, person_role, first_name, last_name)
     values ($1,$2,'PRIMARY','Max','Muster')`, [orgId, customerId]);
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Spartenauswahl', () => {
  it('veroeffentlicht die Auswahl in der uebergebenen Reihenfolge', async () => {
    await asRole('OWNER', CHEF, async () =>
      client.query('select publish_topic_selection($1::jsonb)', [selection([
        { slug: 'krankenkasse', required: true },
        { slug: 'hausrat', required: true },
        { slug: 'reise' },
        { slug: 'cyber', enabled: false },
      ])]));

    const published = await publishedTopics();
    expect(published.map((t) => t.slug)).toEqual(['krankenkasse', 'hausrat', 'reise']);
    expect(published.map((t) => t.required)).toEqual([true, true, false]);
    // Die Reihenfolge des Arrays wird zur Anzeigereihenfolge.
    expect(published.map((t) => t.order)).toEqual([10, 20, 30]);
  });

  it('haelt auch die abgewaehlte Sparte in den Einstellungen fest', async () => {
    const { rows } = await client.query(`
      select t.slug, s.is_enabled from organization_topic_settings s
        join insurance_topics t on t.id = s.topic_id
       where s.organization_id = $1 and t.slug = 'cyber'`, [orgId]);
    expect(rows[0]?.is_enabled).toBe(false);
  });

  // Ohne diese Pruefung entstuende bei jedem Speichern eine weitere,
  // identische Version.
  it('legt bei unveraenderter Auswahl keine zweite Version an', async () => {
    const auswahl = selection([
      { slug: 'krankenkasse', required: true },
      { slug: 'hausrat', required: true },
      { slug: 'reise' },
      { slug: 'cyber', enabled: false },
    ]);
    const first = await asRole('OWNER', CHEF, async () =>
      (await client.query('select publish_topic_selection($1::jsonb) as id', [auswahl])).rows[0].id);
    const second = await asRole('OWNER', CHEF, async () =>
      (await client.query('select publish_topic_selection($1::jsonb) as id', [auswahl])).rows[0].id);
    expect(second).toBe(first);
  });

  it('laesst die Auswahl nicht leer werden', async () => {
    await expect(asRole('OWNER', CHEF, async () =>
      client.query('select publish_topic_selection($1::jsonb)', [selection([
        { slug: 'hausrat', enabled: false },
      ])]))).rejects.toThrow(/Mindestens eine Sparte/);
  });

  it('weist eine unbekannte Sparte zurueck', async () => {
    await expect(asRole('OWNER', CHEF, async () =>
      client.query('select publish_topic_selection($1::jsonb)',
        [JSON.stringify([{ topic_id: '00000000-0000-4000-8000-0000000000ff' }])])))
      .rejects.toThrow(/Unbekannte Sparte/);
  });

  it('laesst einen Berater die Vorlage nicht aendern', async () => {
    await expect(asRole('ADVISOR', ANNA, async () =>
      client.query('select publish_topic_selection($1::jsonb)',
        [selection([{ slug: 'hausrat' }])])))
      .rejects.toThrow(/Keine Berechtigung/);
  });
});

describe('Laufende Beratungen', () => {
  it('behalten ihre Vorlagenversion und ihre Sparten', async () => {
    const sessionId = await asRole('ADVISOR', ANNA, async () =>
      (await client.query('select start_advice_session($1) as id', [customerId])).rows[0].id);

    const before = (await client.query(
      `select count(*)::int n from advice_session_topics where session_id = $1`,
      [sessionId])).rows[0].n;
    const versionBefore = (await client.query(
      'select template_version_id from advice_sessions where id = $1', [sessionId]
    )).rows[0].template_version_id;

    // Mitten im Gespraech alles umstellen.
    await asRole('OWNER', CHEF, async () =>
      client.query('select publish_topic_selection($1::jsonb)', [selection([
        { slug: 'vorsorge', required: true },
      ])]));

    const after = (await client.query(
      `select count(*)::int n from advice_session_topics where session_id = $1`,
      [sessionId])).rows[0].n;
    const versionAfter = (await client.query(
      'select template_version_id from advice_sessions where id = $1', [sessionId]
    )).rows[0].template_version_id;

    expect(after).toBe(before);
    expect(versionAfter).toBe(versionBefore);
  });

  it('starten danach mit der neuen Auswahl', async () => {
    const sessionId = await asRole('ADVISOR', ANNA, async () =>
      (await client.query('select start_advice_session($1) as id', [customerId])).rows[0].id);

    const { rows } = await client.query(`
      select t.slug from advice_session_topics st
        join insurance_topics t on t.id = st.topic_id
       where st.session_id = $1`, [sessionId]);
    expect(rows.map((r) => r.slug)).toEqual(['vorsorge']);
  });
});
