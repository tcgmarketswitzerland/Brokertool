import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, resetSchema } from './helpers/db';

/**
 * Der Access-Token-Hook ist die Stelle, an der ein Fehler entweder alles
 * sperrt oder - schlimmer - zu viel durchlaesst. Beides faellt im Betrieb
 * nicht sofort auf, deshalb hier ausdrueckliche Tests.
 */

let client: Client;

const USER = '00000000-0000-4000-8000-0000000000d1';
const OTHER = '00000000-0000-4000-8000-0000000000d2';

type Claims = {
  claims: { app_metadata?: Record<string, string> };
};

async function runHook(userId: string, existing: Record<string, unknown> = {}): Promise<Claims> {
  const { rows } = await client.query<{ out: Claims }>(
    `select public.custom_access_token_hook(
       jsonb_build_object('user_id', $1::text, 'claims', $2::jsonb)
     ) as out`,
    [userId, JSON.stringify({ sub: userId, app_metadata: existing })],
  );
  return rows[0]!.out;
}

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'dana@broker.ch'), ($2,'dario@broker.ch')`,
    [USER, OTHER]);
  await client.query("select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: USER, role: 'authenticated' })]);
  await client.query('select create_organization($1)', ['Hook Broker AG']);
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Access-Token-Hook', () => {
  it('schreibt Organisation, Rolle und Mitgliedschaft ins JWT', async () => {
    const out = await runHook(USER);
    const meta = out.claims.app_metadata ?? {};
    expect(meta.organization_role).toBe('OWNER');
    expect(meta.organization_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(meta.member_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('setzt fuer einen Nutzer ohne Organisation keine Claims', async () => {
    const meta = (await runHook(OTHER)).claims.app_metadata ?? {};
    expect(meta.organization_id).toBeUndefined();
    expect(meta.organization_role).toBeUndefined();
  });

  it('entfernt veraltete Claims, statt sie stehen zu lassen', async () => {
    // Sonst traegt jemand nach dem Verlassen einer Organisation deren
    // Kennung im Token weiter mit sich herum.
    const meta = (await runHook(OTHER, {
      organization_id: '11111111-1111-4111-8111-111111111111',
      organization_role: 'OWNER',
    })).claims.app_metadata ?? {};
    expect(meta.organization_id).toBeUndefined();
    expect(meta.organization_role).toBeUndefined();
  });

  it('laesst fremde Claims unangetastet', async () => {
    const meta = (await runHook(USER, { provider: 'email' })).claims.app_metadata ?? {};
    expect(meta.provider).toBe('email');
  });

  it('gibt einem deaktivierten Mitglied keine Claims mehr', async () => {
    // Ohne diese Bedingung behielte ein deaktiviertes Mitglied bis zum
    // Ablauf seines Tokens vollen Zugriff.
    // Geprueft wird an einem zweiten Mitglied: der einzige Owner laesst sich
    // nicht deaktivieren, dafuer sorgt guard_last_owner().
    const org = (await client.query(
      `select id from organizations where slug = 'hook-broker-ag'`)).rows[0].id;
    await client.query(
      `insert into organization_members (organization_id, user_id, role, display_name, email)
       values ($1, $2, 'ADVISOR', 'Dario', 'dario@broker.ch')`, [org, OTHER]);
    await client.query(`update profiles set active_organization_id = $1 where id = $2`, [org, OTHER]);

    expect((await runHook(OTHER)).claims.app_metadata?.organization_role).toBe('ADVISOR');

    await client.query(`update organization_members set is_active = false where user_id = $1`, [OTHER]);
    expect((await runHook(OTHER)).claims.app_metadata?.organization_id).toBeUndefined();
  });

  it('der einzige Owner laesst sich nicht deaktivieren', async () => {
    await expect(
      client.query(`update organization_members set is_active = false where user_id = $1`, [USER]),
    ).rejects.toThrow(/mindestens einen Owner/);
  });

  it('ist fuer angemeldete Nutzer nicht ausfuehrbar', async () => {
    // Waere er das, koennte sich jemand eigene Claims zusammenbauen.
    const { rows } = await client.query<{ ok: boolean }>(
      `select has_function_privilege('authenticated',
         'public.custom_access_token_hook(jsonb)', 'EXECUTE') as ok`);
    expect(rows[0]?.ok).toBe(false);
  });
});
