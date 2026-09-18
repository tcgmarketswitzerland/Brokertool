#!/usr/bin/env node
/**
 * Fasst einen Bereich von Migrationen zu einer Datei zusammen.
 *
 *   node scripts/bundle-migrations.mjs 0018 0024
 *
 * Gedacht fuer den Supabase SQL Editor: alles markieren, einfuegen,
 * ausfuehren. Der normale Weg ist scripts/migrate.mjs ueber die
 * GitHub-Action - das Buendel ist die Handvariante fuer den Fall, dass
 * noch keine Verbindung eingerichtet ist.
 *
 * Es ersetzt die Buchfuehrung in migrations.applied nicht. Wer ein
 * Buendel von Hand einspielt, setzt danach
 *   node scripts/migrate.mjs baseline <nr>
 * damit die Action dieselben Schritte nicht ein zweites Mal fahren will.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [from, to] = process.argv.slice(2);
if (!from || !to || !/^\d{4}$/.test(from) || !/^\d{4}$/.test(to)) {
  console.error('Aufruf: node scripts/bundle-migrations.mjs <von> <bis>   z.B. 0018 0024');
  process.exit(1);
}

const dir = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .filter((f) => f.slice(0, 4) >= from && f.slice(0, 4) <= to)
  .sort();

if (files.length === 0) {
  console.error(`Keine Migrationen zwischen ${from} und ${to}.`);
  process.exit(1);
}

const rule = '-- ' + '='.repeat(70);
const today = new Date().toISOString().slice(0, 10);

const parts = [
  `-- Brokertool - Migrationen ${from} bis ${to} in einer Datei`,
  '--',
  '-- Zum Einspielen im Supabase SQL Editor: alles markieren, einfuegen,',
  '-- ausfuehren.',
  '--',
  '-- Mehrfaches Ausfuehren ist unschaedlich: jeder Schritt prueft, ob er',
  '-- schon getan ist.',
  '--',
  `-- Erzeugt am ${today} aus supabase/migrations/.`,
  '',
];

for (const file of files) {
  parts.push('', rule, `-- ${file}`, rule, '', readFileSync(join(dir, file), 'utf8').trim(), '');
}

const out = join(process.cwd(), 'supabase', 'bundles');
mkdirSync(out, { recursive: true });
const target = join(out, `${from}-${to}.sql`);
writeFileSync(target, parts.join('\n') + '\n');

console.log(`${files.length} Migrationen -> supabase/bundles/${from}-${to}.sql`);
