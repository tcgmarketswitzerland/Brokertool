/**
 * Die BAG-Daten in die Dateien des Projekts verwandeln.
 *
 * Einmal im Jahr, wenn das BAG die Praemien fuer das kommende Jahr
 * genehmigt hat (meist Ende September). Aufruf:
 *
 *   node scripts/bag-daten.mjs <ordner-mit-den-bag-dateien>
 *
 * Erwartet in diesem Ordner:
 *   Praemien_CH.csv                        (aus Archiv_Praemien_<jahr>.zip)
 *   praemienregionen.xlsx                  (Blatt A_COM)
 *   zugelassene-krankenversicherer*.xlsx   (Blatt "Zugelassene Krankenversicherer")
 *
 * Erzeugt:
 *   src/data/premium-regions.json      PLZ -> Kanton, Region, Gemeinde
 *   src/data/health-insurers.json      Nummer -> Name, UID, Gruppe
 *   src/data/premiums/index.json       Verzeichnis der Kennzahlen
 *   src/data/premiums/<Kanton>.json    gepackte Praemien, zwoelf Bytes je Zeile
 *
 * Die Daten liegen als Dateien im Projekt und nicht in der Datenbank: sie
 * aendern einmal im Jahr, gehoeren zu keinem Mandanten, und als Teil des
 * Codes ist jederzeit nachvollziehbar, mit welchem Stand eine Beratung
 * gearbeitet hat.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, '\n');

/** Minimaler xlsx-Leser: entpacken, sharedStrings aufloesen, Zellen lesen. */
function readSheet(xlsxPath, sheetFile) {
  const dir = mkdtempSync(join(tmpdir(), 'xlsx-'));
  execFileSync('unzip', ['-qo', xlsxPath, '-d', dir]);

  const ssPath = join(dir, 'xl/sharedStrings.xml');
  const ss = existsSync(ssPath)
    ? [...readFileSync(ssPath, 'utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')))
    : [];

  const xml = readFileSync(join(dir, 'xl/worksheets', sheetFile), 'utf8');
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
    [...r[1].matchAll(/<c\s([^>]*?)\/?>([\s\S]*?)(?:<\/c>|$)/g)].map((c) => {
      const inline = (c[2] ?? '').match(/<t[^>]*>([\s\S]*?)<\/t>/);
      if (inline) return unesc(inline[1]);
      const v = (c[2] ?? '').match(/<v>([\s\S]*?)<\/v>/);
      if (!v) return '';
      return /\bt="s"/.test(c[1]) ? (ss[Number(v[1])] ?? '') : unesc(v[1]);
    }));
}

/**
 * Excel trennt Namen beim Zeilenumbruch. Faellt die Trennung mitten ins
 * Wort - naechste Zeile klein -, gehoert der Bindestrich weg; steht danach
 * ein Grossbuchstabe, ist er echt ("CSS Kranken-Versicherung AG").
 */
function cleanName(raw) {
  return raw
    .replace(/-\s*\n\s*([a-zäöü])/g, '$1')
    .replace(/-\s*\n\s*([A-ZÄÖÜ])/g, '-$1')
    .replace(/([a-zäöü])-([a-zäöü])/g, '$1$2')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function findFile(dir, pattern) {
  const hit = readdirSync(dir).find((f) => pattern.test(f));
  if (!hit) throw new Error(`Datei fehlt in ${dir}: ${pattern}`);
  return join(dir, hit);
}

// --- Prämienregionen -------------------------------------------------------
function regions(dir) {
  const rows = readSheet(findFile(dir, /praemienregionen.*\.xlsx$/i), 'sheet5.xml');
  const data = rows.filter((r) => /^\d+$/.test(r[0] ?? '') && r.length >= 7);

  const byPlz = new Map();
  for (const r of data) {
    const [kanton, gemeinde, region, , plz] = [r[1], r[2], Number(r[3]), r[4], r[5]];
    const list = byPlz.get(plz) ?? [];
    if (!list.some((e) => e[0] === kanton && e[1] === region && e[2] === gemeinde)) {
      list.push([kanton, region, gemeinde]);
    }
    byPlz.set(plz, list);
  }

  const out = Object.fromEntries([...byPlz.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  writeFileSync('src/data/premium-regions.json', JSON.stringify(out));
  return Object.keys(out).length;
}

// --- Versichererverzeichnis ------------------------------------------------
function insurers(dir) {
  const rows = readSheet(findFile(dir, /krankenversicherer.*\.xlsx$/i), 'sheet3.xml');
  const out = {};
  for (const r of rows) {
    const nr = (r[0] ?? '').trim();
    const name = cleanName(r[2] ?? '');
    if (!/^\d+$/.test(nr) || !name) continue;
    out[String(Number(nr))] = { name, uid: (r[1] ?? '').trim(), group: (r[5] ?? '').trim() };
  }
  writeFileSync('src/data/health-insurers.json', JSON.stringify(out));
  return Object.keys(out).length;
}

// --- Prämien ---------------------------------------------------------------
const AGE = ['AKL-KIN', 'AKL-JUG', 'AKL-ERW'];
const ACC = ['OHN-UNF', 'MIT-UNF'];
const TYPE = ['TAR-BASE', 'TAR-HAM', 'TAR-HMO', 'TAR-DIV'];
const FRA = [0, 100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 2500];

function premiums(dir) {
  const lines = readFileSync(findFile(dir, /Pr.*mien_CH\.csv$/i), 'utf8')
    .split(/\r?\n/).filter(Boolean);
  const rows = lines.slice(1).map((l) => l.split(','));

  const year = Number(rows[0]?.[3] ?? 0);
  const insurerNumbers = [...new Set(rows.map((f) => Number(f[0])))].sort((a, b) => a - b);
  const products = [...new Set(rows.map((f) => f[16]))].sort();

  const byCanton = new Map();
  let skipped = 0;

  for (const f of rows) {
    const row = [
      insurerNumbers.indexOf(Number(f[0])),
      Number(f[5].replace('PR-REG CH', '')),
      AGE.indexOf(f[6]), ACC.indexOf(f[7]), TYPE.indexOf(f[9]),
      products.indexOf(f[16]), FRA.indexOf(Number(f[12].replace('FRA-', ''))),
      Math.round(Number(f[13]) * 100),
    ];
    if (row.some((x) => !Number.isFinite(x) || x < 0)) { skipped += 1; continue; }
    const list = byCanton.get(f[1]) ?? [];
    list.push(row);
    byCanton.set(f[1], list);
  }

  if (skipped > 0) throw new Error(`${skipped} Zeilen liessen sich nicht zuordnen`);

  mkdirSync('src/data/premiums', { recursive: true });
  let total = 0;
  for (const [canton, list] of [...byCanton.entries()].sort()) {
    const buf = Buffer.alloc(list.length * 12);
    list.forEach((r, i) => {
      const o = i * 12;
      for (let k = 0; k < 7; k += 1) buf[o + k] = r[k];
      buf.writeUInt32LE(r[7], o + 8);
    });
    writeFileSync(`src/data/premiums/${canton}.json`,
      JSON.stringify({ rows: list.length, data: buf.toString('base64') }));
    total += list.length;
  }

  writeFileSync('src/data/premiums/index.json', JSON.stringify({
    year, insurers: insurerNumbers, products, ageGroups: AGE, accident: ACC,
    tariffTypes: TYPE, franchises: FRA, cantons: [...byCanton.keys()].sort(),
  }));

  return { total, cantons: byCanton.size, year };
}

const dir = process.argv[2];
if (!dir) {
  console.error('Aufruf: node scripts/bag-daten.mjs <ordner-mit-den-bag-dateien>');
  process.exit(1);
}

console.log('Prämienregionen:', regions(dir), 'Postleitzahlen');
console.log('Versicherer:', insurers(dir));
const p = premiums(dir);
console.log(`Prämien ${p.year}: ${p.total} Zeilen in ${p.cantons} Kantonen`);
