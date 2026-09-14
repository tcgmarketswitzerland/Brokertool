# Brokertool

Digitales Sales- und Beratungstool für Versicherungsbroker.

Die Software führt den Berater strukturiert durch ein Kundengespräch und erzeugt daraus
automatisch eine nachvollziehbare Beratungsdokumentation, Kundenentscheidungen und Folgeaufgaben.

## Dokumentation

Die fachlichen und technischen Grundlagen liegen in `docs/` und sind in dieser Reihenfolge zu lesen:

| Datei | Inhalt |
|---|---|
| `01-produkt-und-architektur-analyse.md` | Kritische Analyse, Produkt- und Technikrisiken |
| `02-entscheidungen.md` | Entscheidungsprotokoll (ADR-001 …) |
| `03-architektur.md` | Schichten, Command-Pipeline, RLS, Domain Model |
| `04-projektplan-mvp.md` | Phasen 0–9 mit Abnahmekriterien |
| `05-datenbankstruktur.md` | Vollständiges DDL, Constraints, RLS-Konzept |

## Stand

**Phase 0 (Foundation) abgeschlossen.** Es existiert noch keine Anwendungsfunktionalität —
das Gerüst erzwingt die Architekturregeln, damit spätere Fehlentwicklungen sofort auffallen.

## Entwicklung

```bash
pnpm install
cp .env.example .env.local     # Werte aus dem Supabase-Projekt eintragen
pnpm dev
```

### Prüfkette

`pnpm verify` führt Typecheck, Lint, Tests und Build aus. Vor jedem Commit:

```bash
node scripts/check-service-role.mjs   # Architekturregel R3
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

### Datenbanktests

Die RLS-Tests laufen gegen ein echtes PostgreSQL — Policies lassen sich nicht sinnvoll mocken.
Eine Supabase-CLI wird dafür nicht gebraucht; `tests/db/helpers/supabase-stub.sql` ergänzt
die fehlenden Supabase-Bestandteile.

```bash
createdb brokertool_test
export TEST_DATABASE_URL=postgres://postgres@localhost:5432/brokertool_test
pnpm test:db
```

## Architekturregeln

Diese Regeln werden durch CI erzwungen, nicht durch Disziplin (siehe `docs/03-architektur.md`):

| Regel | Inhalt |
|---|---|
| R1 | `src/domain/**` ist framework-frei — kein React, Next.js oder Supabase |
| R2 | `supabase-js` erscheint nicht in `src/components` und `src/app` |
| R3 | Der `service_role`-Key wird nur in `src/lib/supabase/admin.ts` gelesen |
| R4 | Jede Tabelle hat RLS **und** FORCE RLS und mindestens eine Policy |
| R5 | `organization_id` kommt nie aus Client-Input (Spalten-Default) |
| R8 | Der Logger nimmt nur IDs und Enums, keine Personendaten |

## Betrieb

Datenbank, Auth und Storage in Supabase `eu-central-2` (Zürich), Compute auf Vercel `fra1`
(Frankfurt) — siehe ADR-005. Daten ruhen in der Schweiz, die Verarbeitung erfolgt in der EU.
