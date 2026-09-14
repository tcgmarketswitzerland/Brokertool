import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { asUser, connect, resetSchema } from './helpers/db';

/**
 * Fachliche Absicherung der Phase-1-Vorgaenge. Diese laufen als
 * Datenbankfunktionen, weil sie atomar sein muessen und weil sie Zustaende
 * beruehren, in denen der JWT-Claim noch gar nicht existiert.
 */

let client: Client;

const USER_A = '00000000-0000-4000-8000-0000000000a1';
const USER_B = '00000000-0000-4000-8000-0000000000b1';
const USER_C = '00000000-0000-4000-8000-0000000000c1';

/** Fuehrt eine Anweisung als angemeldeter Nutzer aus, aber ohne aktive Organisation. */
async function asSignedIn<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query('begin');
  await client.query("select set_config('request.jwt.claims', $1, true)",
    [JSON.stringify({ sub: userId, role: 'authenticated' })]);
  try {
    return await fn();
  } finally {
    await client.query('commit');
  }
}

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'anna@broker.ch'), ($2,'ben@broker.ch'), ($3,'cara@broker.ch')`,
    [USER_A, USER_B, USER_C]);
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Registrierung', () => {
  it('legt beim Anlegen eines Nutzers automatisch ein Profil an', async () => {
    const { rows } = await client.query('select id, email from profiles order by email');
    expect(rows.map((r) => r.email)).toEqual(['anna@broker.ch', 'ben@broker.ch', 'cara@broker.ch']);
  });
});

describe('Organisation gruenden', () => {
  let orgId: string;

  it('erzeugt Organisation, Owner-Mitgliedschaft und aktive Organisation in einem Zug', async () => {
    orgId = await asSignedIn(USER_A, async () => {
      const { rows } = await client.query('select create_organization($1) as id', ['Muster Broker AG']);
      return rows[0].id as string;
    });

    const { rows: members } = await client.query(
      'select role, email from organization_members where organization_id = $1', [orgId]);
    expect(members).toEqual([{ role: 'OWNER', email: 'anna@broker.ch' }]);

    const { rows: profile } = await client.query(
      'select active_organization_id from profiles where id = $1', [USER_A]);
    expect(profile[0].active_organization_id).toBe(orgId);
  });

  it('bildet einen lesbaren Slug', async () => {
    const { rows } = await client.query('select slug from organizations where id = $1', [orgId]);
    expect(rows[0].slug).toBe('muster-broker-ag');
  });

  it('nummeriert bei gleichem Namen durch statt zu scheitern', async () => {
    const second = await asSignedIn(USER_B, async () => {
      const { rows } = await client.query('select create_organization($1) as id', ['Muster Broker AG']);
      return rows[0].id as string;
    });
    const { rows } = await client.query('select slug from organizations where id = $1', [second]);
    expect(rows[0].slug).toBe('muster-broker-ag-1');
  });

  it('weist einen leeren Namen zurueck', async () => {
    await expect(
      asSignedIn(USER_C, () => client.query('select create_organization($1)', ['   '])),
    ).rejects.toThrow(/Name der Organisation fehlt/);
  });
});

describe('Einladung', () => {
  let orgId: string;
  const token = 'test-token-' + randomUUID();
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');

  beforeAll(async () => {
    const { rows } = await client.query(
      `select id from organizations where slug = 'muster-broker-ag'`);
    orgId = rows[0].id as string;
    await client.query(
      `insert into invitations (organization_id, email, role, token_hash, expires_at)
       values ($1, 'cara@broker.ch', 'ADVISOR', $2, now() + interval '7 days')`,
      [orgId, tokenHash]);
  });

  it('loest eine gueltige Einladung ein und setzt die Rolle', async () => {
    await asSignedIn(USER_C, () => client.query('select accept_invitation($1)', [token]));
    const { rows } = await client.query(
      'select role, is_active from organization_members where organization_id = $1 and user_id = $2',
      [orgId, USER_C]);
    expect(rows[0]).toEqual({ role: 'ADVISOR', is_active: true });
  });

  it('laesst sich kein zweites Mal einloesen', async () => {
    await expect(
      asSignedIn(USER_C, () => client.query('select accept_invitation($1)', [token])),
    ).rejects.toThrow(/ungueltig oder bereits eingeloest/);
  });

  it('gilt der eingeladenen Adresse, nicht dem Link', async () => {
    // Ein weitergeleiteter Einladungslink darf nicht von einem beliebigen
    // Konto eingeloest werden koennen.
    const other = 'token-' + randomUUID();
    await client.query(
      `insert into invitations (organization_id, email, role, token_hash, expires_at)
       values ($1, 'fremde@broker.ch', 'ADMIN', $2, now() + interval '7 days')`,
      [orgId, createHash('sha256').update(other, 'utf8').digest('hex')]);

    await expect(
      asSignedIn(USER_C, () => client.query('select accept_invitation($1)', [other])),
    ).rejects.toThrow(/andere E-Mail-Adresse/);
  });

  it('weist eine abgelaufene Einladung zurueck und markiert sie', async () => {
    const expired = 'token-' + randomUUID();
    const hash = createHash('sha256').update(expired, 'utf8').digest('hex');
    await client.query(
      `insert into invitations (organization_id, email, role, token_hash, expires_at, created_at)
       values ($1, 'cara@broker.ch', 'ADVISOR', $2, now() - interval '1 day', now() - interval '8 days')`,
      [orgId, hash]);

    await expect(
      asSignedIn(USER_C, () => client.query('select accept_invitation($1)', [expired])),
    ).rejects.toThrow(/abgelaufen/);

    // Die Markierung passiert nicht im Einloeseweg, sondern als Wartungsaufgabe:
    // ein update vor dem raise wuerde mit der Transaktion zurueckgerollt.
    expect((await client.query('select status from invitations where token_hash = $1', [hash]))
      .rows[0].status).toBe('PENDING');
    await client.query('select expire_invitations()');
    expect((await client.query('select status from invitations where token_hash = $1', [hash]))
      .rows[0].status).toBe('EXPIRED');
  });
});

describe('Organisationswechsel', () => {
  it('verweigert den Wechsel in eine fremde Organisation', async () => {
    const { rows } = await client.query(`select id from organizations where slug = 'muster-broker-ag-1'`);
    await expect(
      asSignedIn(USER_C, () => client.query('select switch_organization($1)', [rows[0].id])),
    ).rejects.toThrow(/Keine Mitgliedschaft/);
  });
});

describe('Rollen', () => {
  const cases: ReadonlyArray<[string, string, boolean]> = [
    ['OWNER', 'customers', true],
    ['ADMIN', 'customers', true],
    ['ADVISOR', 'advice_sessions', true],
    ['BACKOFFICE', 'policies', true],
    // Das Backoffice pflegt nach, fuehrt aber keine Beratung (Konzeptpunkt 20).
    ['BACKOFFICE', 'advice_sessions', false],
    ['ADVISOR', 'audit_logs', false],
  ];

  it.each(cases)('%s darf %s schreiben: %s', async (role, table, expected) => {
    const { rows } = await client.query(
      `select set_config('request.jwt.claims', $1, false) is not null as _,
              can_write($2) as allowed`,
      [JSON.stringify({ app_metadata: { organization_role: role } }), table]);
    expect(rows[0].allowed).toBe(expected);
  });

  it('nur der Advisor und hoeher darf eine Beratung abschliessen', async () => {
    for (const [role, expected] of [['OWNER', true], ['ADMIN', true], ['ADVISOR', true], ['BACKOFFICE', false]] as const) {
      const { rows } = await client.query(
        `select set_config('request.jwt.claims', $1, false) is not null as _,
                has_permission('advice:complete') as allowed`,
        [JSON.stringify({ app_metadata: { organization_role: role } })]);
      expect(rows[0].allowed, role).toBe(expected);
    }
  });
});

describe('Owner-Absicherung', () => {
  it('die letzte Owner-Rolle laesst sich nicht entfernen', async () => {
    const { rows } = await client.query(
      `select m.id from organization_members m
         join organizations o on o.id = m.organization_id
        where o.slug = 'muster-broker-ag' and m.role = 'OWNER'`);
    await expect(
      client.query(`update organization_members set role = 'ADVISOR' where id = $1`, [rows[0].id]),
    ).rejects.toThrow(/mindestens einen Owner/);
  });
});

describe('Audit-Log', () => {
  it('haelt Rollenaenderungen mit altem und neuem Wert fest', async () => {
    const { rows: member } = await client.query(
      `select m.id, m.organization_id from organization_members m
         join organizations o on o.id = m.organization_id
        where o.slug = 'muster-broker-ag' and m.role = 'ADVISOR' limit 1`);

    await client.query(`update organization_members set role = 'BACKOFFICE' where id = $1`, [member[0].id]);

    const { rows } = await client.query(
      `select action, changed_fields, recorded_values from audit_logs
        where entity_table = 'organization_members' and entity_id = $1 and action = 'UPDATE'
        order by occurred_at desc limit 1`, [member[0].id]);

    expect(rows[0].changed_fields).toContain('role');
    expect(rows[0].recorded_values.role).toEqual({ von: 'ADVISOR', nach: 'BACKOFFICE' });
  });

  it('ist fuer niemanden aenderbar oder loeschbar', async () => {
    const orgId = (await client.query(`select id from organizations where slug='muster-broker-ag'`)).rows[0].id;
    const statements = [
      `update audit_logs set action = 'DELETE' where organization_id = $1`,
      'delete from audit_logs where organization_id = $1',
    ];
    for (const stmt of statements) {
      const res = await asUser(client, { userId: USER_A, organizationId: orgId, role: 'OWNER' },
        () => client.query(stmt, [orgId]));
      expect(res.rowCount, stmt).toBe(0);
    }
  });
});
