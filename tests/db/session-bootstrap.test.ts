import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, resetSchema } from './helpers/db';

/**
 * Die Weiche nach der Anmeldung.
 *
 * Drei Zustaende sehen in der Anwendung gleich aus - leer. Diese Funktion
 * ist das Einzige, was sie auseinanderhaelt, und deshalb genau der Ort,
 * an dem ein Fehler teuer waere.
 */

let client: Client;
const OWNER = '00000000-0000-4000-8000-00000000b0b1';
const FRESH = '00000000-0000-4000-8000-00000000b0b2';
let orgId = '';

type Bootstrap = { has_membership: boolean; claim_org: string | null };

async function bootstrapAs(userId: string, orgClaim?: string): Promise<Bootstrap> {
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({
      sub: userId,
      role: 'authenticated',
      ...(orgClaim
        ? { app_metadata: { organization_id: orgClaim, organization_role: 'OWNER' } }
        : {}),
    })]);
  const { rows } = await client.query('select public.session_bootstrap() as s');
  return rows[0].s as Bootstrap;
}

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'bo@broker.ch'), ($2,'neu@broker.ch')`,
    [OWNER, FRESH]);

  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: OWNER, role: 'authenticated' })]);
  orgId = (await client.query('select create_organization($1) as id', ['Bo AG'])).rows[0].id;
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Zustand der Sitzung', () => {
  it('meldet "eingerichtet", wenn Firma und Token zusammenpassen', async () => {
    const s = await bootstrapAs(OWNER, orgId);
    expect(s.has_membership).toBe(true);
    expect(s.claim_org).toBe(orgId);
  });

  it('meldet die fehlende Firma bei einem frisch bestaetigten Konto', async () => {
    // Genau der Fall nach der Bestaetigungsmail: angemeldet, aber ohne Firma.
    const s = await bootstrapAs(FRESH);
    expect(s.has_membership).toBe(false);
    expect(s.claim_org).toBeNull();
  });

  it('erkennt ein Token, das die vorhandene Firma noch nicht kennt', async () => {
    // Der zweite teure Fall: Mitgliedschaft besteht, Token ist aelter.
    // Ohne diese Unterscheidung sieht es aus wie der Fall darueber.
    const s = await bootstrapAs(OWNER);
    expect(s.has_membership).toBe(true);
    expect(s.claim_org).toBeNull();
  });

  it('sieht die eigene Mitgliedschaft auch ohne Mandantenkennung im Token', async () => {
    // Der Grund fuer SECURITY DEFINER: ohne Kennung sperren die Policies
    // sonst auch den Blick auf die eigene Zeile, und die Weiche waere blind.
    const { rows } = await client.query(
      'select count(*)::int n from organization_members where user_id = $1', [OWNER]);
    expect(rows[0].n).toBe(1);
    expect((await bootstrapAs(OWNER)).has_membership).toBe(true);
  });

  it('meldet nichts fuer ein deaktiviertes Mitglied', async () => {
    // Deaktiviert heisst kein Zugang - nicht "Firma neu anlegen". Geprueft
    // an einem Berater, nicht am Owner: den letzten Owner laesst die
    // Datenbank ohnehin nicht deaktivieren.
    await client.query(
      `insert into organization_members (organization_id, user_id, role, display_name, email)
       values ($1,$2,'ADVISOR','Neu','neu@broker.ch')`, [orgId, FRESH]);
    expect((await bootstrapAs(FRESH, orgId)).has_membership).toBe(true);

    await client.query(
      'update organization_members set is_active = false where user_id = $1', [FRESH]);
    expect((await bootstrapAs(FRESH, orgId)).has_membership).toBe(false);
  });
});
