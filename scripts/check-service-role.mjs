#!/usr/bin/env node
/**
 * Regel R3 (Architektur 1): Der service_role-Key umgeht RLS vollstaendig und
 * ist damit die groesste einzelne Sicherheitsgefahr des Projekts. Er darf an
 * genau einer Stelle gelesen werden.
 *
 * ESLint sieht nur Imports, nicht jeden Weg zu einer Umgebungsvariablen -
 * deshalb dieser zusaetzliche Baumscan in der CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const ALLOWED = new Set(['src/lib/supabase/admin.ts']);
const NEEDLE = 'SUPABASE_SECRET_KEY';
const SEARCH_DIRS = ['src', 'app', 'scripts'];

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) continue;

    const rel = relative(ROOT, full).replaceAll('\\', '/');
    if (ALLOWED.has(rel) || rel === 'scripts/check-service-role.mjs') continue;
    if (readFileSync(full, 'utf8').includes(NEEDLE)) offenders.push(rel);
  }
}

for (const dir of SEARCH_DIRS) {
  try { walk(join(ROOT, dir)); } catch { /* Verzeichnis existiert noch nicht */ }
}

if (offenders.length > 0) {
  console.error(`R3 verletzt: ${NEEDLE} ausserhalb von ${[...ALLOWED].join(', ')}`);
  for (const f of offenders) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`R3 ok: ${NEEDLE} nur in ${[...ALLOWED].join(', ')}`);
