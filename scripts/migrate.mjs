/**
 * Migrationen einspielen - nachvollziehbar, genau einmal, in Reihenfolge.
 *
 *   node scripts/migrate.mjs status        zeigt an, was fehlt
 *   node scripts/migrate.mjs up            spielt alles Ausstehende ein
 *   node scripts/migrate.mjs baseline 0023 markiert alles bis 0023 als
 *                                         eingespielt, ohne es auszufuehren
 *
 * Die Verbindung kommt aus DATABASE_URL.
 *
 * Warum ein eigener Laeufer statt der Supabase-CLI: die erwartet
 * Zeitstempel als Dateinamen (20260101120000_name.sql) und fuehrt ein
 * eigenes Verzeichnis. Auf einer Datenbank, auf der die ersten Migrationen
 * von Hand eingespielt wurden, wuerde sie alles noch einmal anwenden - und
 * daran scheitern. Der Baseline-Befehl loest genau das.
 *
 * Das Verzeichnis liegt im eigenen Schema "migrations" und nicht in
 * "public": dort verlangt assert_rls_complete() von jeder Tabelle
 * Sicherheitsregeln, und eine Verwaltungstabelle ohne Mandanten hat dort
 * nichts zu suchen.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const DIR = join(process.cwd(), 'supabase', 'migrations');

function migrationFiles() {
  return readdirSync(DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(DIR, name), 'utf8');
      return { name, sql, hash: createHash('sha256').update(sql).digest('hex') };
    });
}

async function ensureTable(client) {
  await client.query('create schema if not exists migrations');
  await client.query(`
    create table if not exists migrations.applied (
      name        text primary key,
      hash        text not null,
      applied_at  timestamptz not null default now(),
      duration_ms int,
      -- Wer hat es eingespielt: der Actions-Lauf oder ein Mensch.
      applied_by  text
    )`);
}

async function appliedRows(client) {
  const { rows } = await client.query(
    'select name, hash, applied_at from migrations.applied order by name');
  return new Map(rows.map((r) => [r.name, r]));
}

/**
 * Eine bereits eingespielte Migration darf sich nicht mehr aendern. Sonst
 * steht in der Datenbank etwas anderes als im Projekt, und niemand merkt
 * es - der teuerste denkbare Zustand.
 */
function checkUnchanged(files, applied) {
  const changed = files.filter((f) => {
    const row = applied.get(f.name);
    return row && row.hash !== f.hash;
  });
  if (changed.length > 0) {
    throw new Error(
      `Bereits eingespielte Migrationen wurden nachtraeglich geaendert: `
      + `${changed.map((c) => c.name).join(', ')}. `
      + `Aenderungen gehoeren in eine neue Migration, nicht in eine alte.`);
  }
}

async function connect() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL fehlt.');
  const client = new pg.Client({
    connectionString,
    // Supabase erzwingt TLS; das Zertifikat der Poolverbindung traegt
    // einen anderen Namen als der Host.
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function status(client) {
  const files = migrationFiles();
  const applied = await appliedRows(client);
  checkUnchanged(files, applied);

  const pending = files.filter((f) => !applied.has(f.name));
  console.log(`Migrationen im Projekt: ${files.length}`);
  console.log(`Bereits eingespielt:    ${applied.size}`);
  console.log(`Ausstehend:             ${pending.length}`);
  for (const f of pending) console.log(`  + ${f.name}`);
  return pending;
}

async function up(client) {
  const pending = await status(client);
  if (pending.length === 0) {
    console.log('\nNichts zu tun.');
    return;
  }

  const by = process.env.GITHUB_RUN_ID
    ? `github-actions #${process.env.GITHUB_RUN_ID}`
    : (process.env.USER ?? 'unbekannt');

  console.log('');
  for (const f of pending) {
    const started = Date.now();
    process.stdout.write(`${f.name} … `);
    // Jede Migration in einer eigenen Transaktion: schlaegt eine fehl,
    // bleibt der Stand davor vollstaendig und das Verzeichnis stimmt.
    await client.query('begin');
    try {
      await client.query(f.sql);
      await client.query(
        `insert into migrations.applied (name, hash, duration_ms, applied_by)
         values ($1, $2, $3, $4)`,
        [f.name, f.hash, Date.now() - started, by]);
      await client.query('commit');
      console.log(`ok (${Date.now() - started} ms)`);
    } catch (error) {
      await client.query('rollback');
      console.log('FEHLGESCHLAGEN');
      throw error;
    }
  }

  console.log(`\n${pending.length} Migrationen eingespielt.`);
}

/**
 * Bestehende Datenbank uebernehmen: alles bis einschliesslich <bis> gilt
 * als eingespielt, ohne dass es ausgefuehrt wird. Fuer die Umstellung
 * einer Datenbank, auf der bisher von Hand migriert wurde.
 */
async function baseline(client, upTo) {
  if (!upTo) throw new Error('Angabe fehlt: baseline <nummer>, zum Beispiel 0023');

  const files = migrationFiles().filter((f) => f.name.slice(0, 4) <= upTo);
  if (files.length === 0) throw new Error(`Keine Migration bis ${upTo} gefunden.`);

  for (const f of files) {
    await client.query(
      `insert into migrations.applied (name, hash, duration_ms, applied_by)
       values ($1, $2, 0, $3) on conflict (name) do nothing`,
      [f.name, f.hash, 'baseline']);
  }
  console.log(`${files.length} Migrationen als eingespielt vermerkt (bis ${upTo}).`);
  console.log('Ausgefuehrt wurde nichts.');
}

const [command, argument] = process.argv.slice(2);

let client;
try {
  client = await connect();
  await ensureTable(client);
  if (command === 'status') await status(client);
  else if (command === 'up') await up(client);
  else if (command === 'baseline') await baseline(client, argument);
  else {
    console.error('Aufruf: node scripts/migrate.mjs status | up | baseline <nummer>');
    process.exitCode = 1;
  }
} catch (error) {
  // Klartext statt Aufrufliste: das hier liest jemand im Protokoll eines
  // fehlgeschlagenen Laufs, und dort hilft der Satz, nicht der Stapel.
  console.error(`\nFehler: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client?.end();
}
