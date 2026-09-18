import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { claimsFor, connect, resetSchema } from './helpers/db';

/**
 * Firmenangaben und Erscheinungsbild (Migration 0025).
 *
 * Diese Zeilen stehen auf jedem Beratungsprotokoll. Die Regeln liegen
 * deshalb in der Datenbank und nicht nur im Formular: eine Postleitzahl
 * mit fuenf Stellen faellt sonst erst dem Kunden auf, dem das Dokument
 * vorliegt.
 */

let client: Client;
const OWNER = '00000000-0000-4000-8000-0000000006a1';
const ADVISOR = '00000000-0000-4000-8000-0000000006a2';
let orgId = '';

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

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'owner@broker.ch'), ($2,'advisor@broker.ch')`,
    [OWNER, ADVISOR]);
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: OWNER, role: 'authenticated' })]);
  orgId = (await client.query('select create_organization($1) as id', ['Muster Broker AG'])).rows[0].id;
}, 60_000);

afterAll(async () => { await client?.end(); });

const LOGO = 'iVBORw0KGgo'.repeat(20);

describe('Firmenangaben', () => {
  it('nimmt eine vollstaendige Adresse an', async () => {
    const { rowCount } = await asRole('OWNER', OWNER, async () =>
      client.query(
        `update organizations set street=$1, postal_code=$2, city=$3,
                phone=$4, email=$5, website=$6`,
        ['Bahnhofstrasse 1', '8001', 'Zürich', '044 123 45 67',
         'beratung@muster.ch', 'https://muster.ch']));
    expect(rowCount).toBe(1);
  });

  it('weist eine Postleitzahl zurueck, die keine Schweizer ist', async () => {
    await expect(asRole('OWNER', OWNER, async () =>
      client.query(`update organizations set postal_code = '80010'`)))
      .rejects.toThrow(/organizations_postal_code_ch/);
    await expect(asRole('OWNER', OWNER, async () =>
      client.query(`update organizations set postal_code = '0801'`)))
      .rejects.toThrow(/organizations_postal_code_ch/);
  });

  it('weist eine Farbe zurueck, die kein Hexwert ist', async () => {
    await expect(asRole('OWNER', OWNER, async () =>
      client.query(`update organizations set brand_color = 'tiefblau'`)))
      .rejects.toThrow(/organizations_brand_color_hex/);
  });

  it('nimmt eine Hexfarbe an', async () => {
    const { rowCount } = await asRole('OWNER', OWNER, async () =>
      client.query(`update organizations set brand_color = '#0f766e'`));
    expect(rowCount).toBe(1);
  });

  // Ein Bild ohne Typ liesse sich nicht anzeigen, ein Typ ohne Bild nichts.
  it('weist ein halbes Logo zurueck', async () => {
    await expect(asRole('OWNER', OWNER, async () =>
      client.query(`update organizations set logo_base64 = $1, logo_content_type = null`, [LOGO])))
      .rejects.toThrow(/organizations_logo_pair/);
  });

  it('weist ein Logo im falschen Format zurueck', async () => {
    await expect(asRole('OWNER', OWNER, async () =>
      client.query(
        `update organizations set logo_base64 = $1, logo_content_type = 'image/svg+xml'`, [LOGO])))
      .rejects.toThrow(/organizations_logo_type/);
  });

  it('nimmt ein vollstaendiges Logo an und laesst es wieder entfernen', async () => {
    await asRole('OWNER', OWNER, async () =>
      client.query(
        `update organizations set logo_base64 = $1, logo_content_type = 'image/png'`, [LOGO]));
    const { rowCount } = await asRole('OWNER', OWNER, async () =>
      client.query(`update organizations set logo_base64 = null, logo_content_type = null`));
    expect(rowCount).toBe(1);
  });

  // Wer beraet, aendert nicht die Firma. Die Policy auf organizations
  // verlangt organization:write - das haben nur Owner und Admin.
  it('laesst einen Berater die Firmenangaben nicht aendern', async () => {
    const { rowCount } = await asRole('ADVISOR', ADVISOR, async () =>
      client.query(`update organizations set city = 'Bern'`));
    expect(rowCount).toBe(0);
  });

  it('schreibt jede Aenderung ins Audit-Log', async () => {
    await asRole('OWNER', OWNER, async () =>
      client.query(`update organizations set city = 'Winterthur'`));

    const { rows } = await client.query(
      `select organization_id, entity_table, changed_fields
         from audit_logs
        where entity_table = 'organizations' and entity_id = $1
        order by occurred_at desc limit 1`, [orgId]);

    expect(rows[0]?.organization_id).toBe(orgId);
    expect(rows[0]?.changed_fields).toContain('city');
  });
});
