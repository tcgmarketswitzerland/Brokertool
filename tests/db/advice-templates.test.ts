import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asUser, connect, resetSchema } from './helpers/db';

/**
 * Spartenkatalog und Beratungsvorlagen. Die Vorlage ist die Klammer, die
 * Konfigurierbarkeit, Nachvollziehbarkeit und spaetere Firmenkunden
 * gemeinsam loest (Architektur 2.10).
 */

let client: Client;
const USER = '00000000-0000-4000-8000-0000000000f1';
const OTHER = '00000000-0000-4000-8000-0000000000f2';
let orgA = '';
let orgB = '';

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'fabio@broker.ch'), ($2,'flavia@broker.ch')`,
    [USER, OTHER]);

  for (const [user, name] of [[USER, 'Fabio AG'], [OTHER, 'Flavia AG']] as const) {
    await client.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({ sub: user, role: 'authenticated' })]);
    const { rows } = await client.query('select create_organization($1) as id', [name]);
    if (user === USER) orgA = rows[0].id; else orgB = rows[0].id;
  }
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Spartenkatalog', () => {
  it('enthaelt genau die elf verbindlichen Sparten in der vorgegebenen Reihenfolge', async () => {
    const { rows } = await client.query(
      `select slug from insurance_topics where is_active order by display_order`);
    expect(rows.map((r) => r.slug)).toEqual([
      'hausrat', 'privathaftpflicht', 'gebaeude', 'motorfahrzeug', 'rechtsschutz',
      'reise', 'cyber', 'krankenkasse', 'risiko', 'vorsorge', 'hypothek',
    ]);
  });

  it('jede aktive Sparte hat ein Symbol', async () => {
    // Ohne Symbol faellt eine Sparte in Liste und Rad aus dem Bild.
    const { rows } = await client.query(
      `select slug from insurance_topics where is_active and (icon is null or icon = '')`);
    expect(rows).toEqual([]);
  });

  it('entfernte Sparten werden deaktiviert, nicht geloescht', async () => {
    // An ihnen koennen bereits Beratungen haengen, die nachvollziehbar
    // bleiben muessen.
    const { rows } = await client.query(
      `select slug, is_active from insurance_topics
        where slug in ('unfall','todesfall','saeule3a','haustiere','erwerbsunfaehigkeit')`);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.is_active === false)).toBe(true);
  });

  it('hat fuer jede Sparte einen deutschen Namen', async () => {
    const { rows } = await client.query(
      `select slug from insurance_topics where not (name ? 'de')`);
    expect(rows).toEqual([]);
  });

  it('ist fuer Angemeldete lesbar, aber nicht beschreibbar', async () => {
    const lesbar = await asUser(client, { userId: USER, organizationId: orgA, role: 'OWNER' },
      async () => (await client.query(
        'select count(*)::int as n from insurance_topics where is_active')).rows[0].n);
    expect(lesbar).toBe(11);

    const res = await asUser(client, { userId: USER, organizationId: orgA, role: 'OWNER' },
      () => client.query(`update insurance_topics set is_active = false`));
    expect(res.rowCount).toBe(0);
  });
});

describe('Standardvorlage bei Firmengruendung', () => {
  it('jede Firma bekommt eine eigene veroeffentlichte Vorlage', async () => {
    for (const org of [orgA, orgB]) {
      const { rows } = await client.query(
        `select v.status from advice_template_versions v
           join advice_templates t on t.id = v.template_id
          where t.organization_id = $1 and t.is_default`, [org]);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.every((r) => r.status === 'PUBLISHED')).toBe(true);
    }
  });

  it('die juengste Vorlagenversion enthaelt alle aktiven Privatkundensparten', async () => {
    const { rows } = await client.query(
      `select count(*)::int as n from advice_template_topics tt
        where tt.template_version_id = (
          select v.id from advice_template_versions v
            join advice_templates t on t.id = v.template_id
           where t.organization_id = $1 and t.is_default
           order by v.version desc limit 1)`, [orgA]);
    expect(rows[0].n).toBe(11);
  });

  it('markiert die Sparten, die jeden Haushalt betreffen, als Pflicht', async () => {
    const { rows } = await client.query(
      `select t.slug from advice_template_topics tt
         join insurance_topics t on t.id = tt.topic_id
        where tt.is_required
          and tt.template_version_id = (
            select v.id from advice_template_versions v
              join advice_templates t2 on t2.id = v.template_id
             where t2.organization_id = $1 and t2.is_default
             order by v.version desc limit 1)
        order by t.display_order`, [orgA]);
    // Fachliche Vorgabe: alle elf Sparten sind Pflicht. Das funktioniert
    // nur, weil Ueberspringen eine vollwertige, protokollierte Entscheidung
    // ist und kein Schlupfloch.
    expect(rows.map((r) => r.slug)).toEqual([
      'hausrat', 'privathaftpflicht', 'gebaeude', 'motorfahrzeug', 'rechtsschutz',
      'reise', 'cyber', 'krankenkasse', 'risiko', 'vorsorge', 'hypothek',
    ]);
  });

  it('die Vorlagen zweier Firmen sind getrennt', async () => {
    const { rows } = await client.query(
      `select organization_id from advice_templates order by organization_id`);
    expect(new Set(rows.map((r) => r.organization_id)).size).toBe(2);
  });
});

describe('Unveraenderlichkeit veroeffentlichter Vorlagen', () => {
  it('eine veroeffentlichte Version laesst sich nicht aendern', async () => {
    const { rows } = await client.query(
      `select v.id from advice_template_versions v
         join advice_templates t on t.id = v.template_id
        where t.organization_id = $1 order by v.version desc limit 1`, [orgA]);

    await expect(
      client.query(`update advice_template_versions set version = 99 where id = $1`, [rows[0].id]),
    ).rejects.toThrow(/unveraenderlich/);
  });

  it('ihre Sparten lassen sich weder aendern noch entfernen', async () => {
    // Ohne diesen Schutz wuerde eine nachtraegliche Aenderung rueckwirkend
    // die Bewertung bereits gefuehrter Beratungen verschieben.
    const { rows } = await client.query(
      `select id from advice_template_topics where organization_id = $1 limit 1`, [orgA]);

    await expect(
      client.query(`update advice_template_topics set is_required = true where id = $1`, [rows[0].id]),
    ).rejects.toThrow(/veroeffentlicht/);

    await expect(
      client.query(`delete from advice_template_topics where id = $1`, [rows[0].id]),
    ).rejects.toThrow(/veroeffentlicht/);
  });

  it('archivieren bleibt erlaubt', async () => {
    const { rows } = await client.query(
      `select v.id from advice_template_versions v
         join advice_templates t on t.id = v.template_id
        where t.organization_id = $1 order by v.version desc limit 1`, [orgB]);

    await expect(
      client.query(`update advice_template_versions set status = 'ARCHIVED' where id = $1`, [rows[0].id]),
    ).resolves.toBeDefined();
  });
});

describe('Mandantentrennung bei Vorlagen', () => {
  it('eine fremde Firma sieht die Vorlage nicht', async () => {
    const rows = await asUser(client, { userId: OTHER, organizationId: orgB, role: 'OWNER' },
      async () => (await client.query(
        `select id from advice_templates where organization_id = $1`, [orgA])).rows);
    expect(rows).toEqual([]);
  });
});
