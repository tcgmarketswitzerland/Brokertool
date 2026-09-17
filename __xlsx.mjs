import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Minimaler xlsx-Leser: sharedStrings plus Zellen. Reicht, um zu sehen,
// was in den Dateien steht - fuer den spaeteren Import kommt ein richtiger.
function shared(dir) {
  const p = join(dir, 'xl/sharedStrings.xml');
  if (!existsSync(p)) return [];
  const xml = readFileSync(p, 'utf8');
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
}

function sheet(dir, file, limit = 8) {
  const xml = readFileSync(join(dir, 'xl/worksheets', file), 'utf8');
  const ss = shared(dir);
  const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].slice(0, limit);
  return rows.map((r) =>
    [...r[1].matchAll(/<c[^>]*?(?:t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?<\/c>/g)]
      .map((c) => {
        if (c[3] !== undefined) return c[3];
        if (c[1] === 's') return ss[Number(c[2])] ?? '';
        return c[2] ?? '';
      }));
}

const dir = process.argv[2];
const wb = readFileSync(join(dir, 'xl/workbook.xml'), 'utf8');
const names = [...wb.matchAll(/<sheet name="([^"]*)"[^>]*r:id="rId(\d+)"/g)].map((m) => [m[1], m[2]]);
const files = readdirSync(join(dir, 'xl/worksheets')).filter((f) => f.endsWith('.xml')).sort(
  (a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));

for (const [i, f] of files.entries()) {
  const total = (readFileSync(join(dir, 'xl/worksheets', f), 'utf8').match(/<row /g) ?? []).length;
  console.log(`\n=== ${names[i]?.[0] ?? f}  (${total} Zeilen) ===`);
  for (const row of sheet(dir, f, 5)) console.log('  ' + row.slice(0, 12).join(' | '));
}
