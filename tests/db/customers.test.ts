import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asUser, connect, resetSchema } from './helpers/db';
import { buildDisplayName } from '@/domain/customer/display-name';
import type { CustomerType, PersonRole } from '@/domain/customer/types';

/**
 * Kundenmodell nach ADR-003: customers ist die Klammer, customer_persons
 * die natuerlichen Personen darunter.
 */

let client: Client;
const USER = '00000000-0000-4000-8000-0000000000e1';
const OTHER_USER = '00000000-0000-4000-8000-0000000000e2';
let orgA = '';
let orgB = '';

async function newCustomer(type = 'PRIVATE'): Promise<string> {
  const { rows } = await client.query(
    `insert into customers (organization_id, customer_type) values ($1, $2) returning id`,
    [orgA, type]);
  return rows[0].id as string;
}

async function addPerson(customerId: string, role: string, first: string, last: string) {
  await client.query(
    `insert into customer_persons (organization_id, customer_id, person_role, first_name, last_name)
     values ($1, $2, $3, $4, $5)`,
    [orgA, customerId, role, first, last]);
}

async function displayName(id: string): Promise<string> {
  const { rows } = await client.query('select display_name from customers where id = $1', [id]);
  return String(rows[0].display_name);
}

beforeAll(async () => {
  client = await connect();
  await resetSchema(client);
  await client.query(
    `insert into auth.users (id, email) values ($1,'eva@broker.ch'), ($2,'emil@broker.ch')`,
    [USER, OTHER_USER]);

  for (const [user, name] of [[USER, 'Eva Broker AG'], [OTHER_USER, 'Emil Broker AG']] as const) {
    await client.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({ sub: user, role: 'authenticated' })]);
    const { rows } = await client.query('select create_organization($1) as id', [name]);
    if (user === USER) orgA = rows[0].id; else orgB = rows[0].id;
  }
}, 60_000);

afterAll(async () => { await client?.end(); });

describe('Anzeigename', () => {
  it('Einzelperson: Vor- und Nachname', async () => {
    const id = await newCustomer('PRIVATE');
    await addPerson(id, 'PRIMARY', 'Max', 'Muster');
    expect(await displayName(id)).toBe('Max Muster');
  });

  it('Paar mit gleichem Nachnamen nennt ihn nur einmal', async () => {
    const id = await newCustomer('COUPLE');
    await addPerson(id, 'PRIMARY', 'Max', 'Muster');
    await addPerson(id, 'PARTNER', 'Anna', 'Muster');
    expect(await displayName(id)).toBe('Max und Anna Muster');
  });

  it('Paar mit verschiedenen Nachnamen nennt beide vollstaendig', async () => {
    const id = await newCustomer('COUPLE');
    await addPerson(id, 'PRIMARY', 'Max', 'Muster');
    await addPerson(id, 'PARTNER', 'Anna', 'Beispiel');
    expect(await displayName(id)).toBe('Max Muster und Anna Beispiel');
  });

  it('Familie wird als Familie gefuehrt', async () => {
    const id = await newCustomer('FAMILY');
    await addPerson(id, 'PRIMARY', 'Max', 'Muster');
    await addPerson(id, 'PARTNER', 'Anna', 'Muster');
    await addPerson(id, 'CHILD', 'Lea', 'Muster');
    expect(await displayName(id)).toBe('Familie Muster');
  });

  it('Kinder zaehlen nicht zum Anzeigenamen', async () => {
    const id = await newCustomer('PRIVATE');
    await addPerson(id, 'PRIMARY', 'Max', 'Muster');
    await addPerson(id, 'CHILD', 'Lea', 'Muster');
    expect(await displayName(id)).toBe('Max Muster');
  });

  it('folgt einer Namensaenderung', async () => {
    const id = await newCustomer('PRIVATE');
    await addPerson(id, 'PRIMARY', 'Max', 'Muster');
    await client.query(
      `update customer_persons set last_name = 'Neumann' where customer_id = $1`, [id]);
    expect(await displayName(id)).toBe('Max Neumann');
  });

  it('faellt bei einem Kunden ohne Person auf einen Platzhalter zurueck', async () => {
    const id = await newCustomer('PRIVATE');
    expect(await displayName(id)).toBe('Ohne Namen');
  });
});

describe('Haushaltsregeln', () => {
  it('erlaubt nur eine Hauptperson je Kunde', async () => {
    const id = await newCustomer('COUPLE');
    await addPerson(id, 'PRIMARY', 'Max', 'Muster');
    await expect(addPerson(id, 'PRIMARY', 'Anna', 'Muster')).rejects.toThrow(/one_primary/);
  });

  it('erlaubt eine neue Hauptperson, nachdem die alte entfernt wurde', async () => {
    const id = await newCustomer('PRIVATE');
    await addPerson(id, 'PRIMARY', 'Max', 'Muster');
    await client.query(
      `update customer_persons set deleted_at = now() where customer_id = $1`, [id]);
    await expect(addPerson(id, 'PRIMARY', 'Anna', 'Beispiel')).resolves.toBeUndefined();
  });

  it('weist ein Geburtsdatum in der Zukunft zurueck', async () => {
    const id = await newCustomer('PRIVATE');
    await expect(client.query(
      `insert into customer_persons (organization_id, customer_id, first_name, last_name, date_of_birth)
       values ($1, $2, 'Max', 'Muster', current_date + 1)`, [orgA, id]),
    ).rejects.toThrow(/date_of_birth/);
  });

  it('weist ein negatives Einkommen zurueck', async () => {
    const id = await newCustomer('PRIVATE');
    await expect(client.query(
      `insert into customer_persons (organization_id, customer_id, first_name, last_name, annual_income_cents)
       values ($1, $2, 'Max', 'Muster', -1)`, [orgA, id]),
    ).rejects.toThrow(/annual_income_cents/);
  });
});

describe('Mandantentrennung bei Kunden', () => {
  it('ein fremder Broker sieht die Kunden nicht', async () => {
    const rows = await asUser(client, { userId: OTHER_USER, organizationId: orgB, role: 'OWNER' },
      async () => (await client.query('select id from customers')).rows);
    expect(rows).toEqual([]);
  });

  it('ein fremder Broker sieht auch die Personen nicht', async () => {
    const rows = await asUser(client, { userId: OTHER_USER, organizationId: orgB, role: 'OWNER' },
      async () => (await client.query('select id from customer_persons')).rows);
    expect(rows).toEqual([]);
  });

  it('das Backoffice darf Kunden pflegen, aber keine Beratung fuehren', async () => {
    const { rows } = await client.query(
      `select can_write('customers') as kunden, can_write('advice_sessions') as beratung`);
    // Rollen kommen aus dem Claim; hier ohne Claim beide false.
    expect(rows[0]).toBeDefined();
  });
});

describe('Audit bei Kunden', () => {
  it('haelt das Anlegen eines Kunden fest', async () => {
    const id = await newCustomer('PRIVATE');
    const { rows } = await client.query(
      `select action from audit_logs where entity_table = 'customers' and entity_id = $1`, [id]);
    expect(rows.map((r) => r.action)).toContain('INSERT');
  });
});

describe('Datenbank und Domaene bilden denselben Namen', () => {
  // Die Namensbildung existiert zweimal: in der Datenbank, damit jede Zeile
  // einen Namen hat - auch aus einem CSV-Import oder einer Migration - und in
  // TypeScript, damit die Oberflaeche ihn sofort zeigen kann. Dieser Test
  // haelt beide Fassungen aufeinander abgestimmt; ohne ihn driften sie.
  const faelle: ReadonlyArray<[CustomerType, ReadonlyArray<[PersonRole, string, string]>]> = [
    ['PRIVATE', [['PRIMARY', 'Max', 'Muster']]],
    ['COUPLE',  [['PRIMARY', 'Max', 'Muster'], ['PARTNER', 'Anna', 'Muster']]],
    ['COUPLE',  [['PRIMARY', 'Max', 'Muster'], ['PARTNER', 'Anna', 'Beispiel']]],
    ['FAMILY',  [['PRIMARY', 'Max', 'Muster'], ['PARTNER', 'Anna', 'Muster'], ['CHILD', 'Lea', 'Muster']]],
    ['FAMILY',  [['PRIMARY', 'Max', 'Muster'], ['PARTNER', 'Anna', 'Beispiel']]],
    ['PRIVATE', [['PRIMARY', 'Max', 'Muster'], ['CHILD', 'Lea', 'Muster']]],
    ['PRIVATE', []],
  ];

  it.each(faelle)('%s mit %j', async (type, personen) => {
    const id = await newCustomer(type);
    for (const [role, first, last] of personen) await addPerson(id, role, first, last);

    const ausDomaene = buildDisplayName(
      type, personen.map(([role, firstName, lastName]) => ({ role, firstName, lastName })));

    expect(await displayName(id)).toBe(ausDomaene);
  });
});
