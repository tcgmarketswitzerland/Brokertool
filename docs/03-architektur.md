# Schritt 2 — Technische Architektur

Grundlage: `01-produkt-und-architektur-analyse.md`, Entscheidungen ADR-001 bis ADR-004.
Datum: 2026-09-14

---

## 0. Leitgedanke

Die Architektur folgt einer einzigen Prioritätenordnung:

1. **Tenant-Isolation** — technisch erzwungen, nicht per Konvention.
2. **Nachvollziehbarkeit** — eine abgeschlossene Beratung ist unveränderlich und beweisbar.
3. **Wartbarkeit durch eine Person** — jede Abstraktion muss sich rechtfertigen.
4. **Robustheit im Gespräch** — kein Datenverlust vor dem Kunden.

Alles andere ist nachgeordnet. Wo diese vier kollidieren, gewinnt die niedrigere Nummer.

---

## 1. Architekturregeln (verbindlich)

Diese Regeln werden, wo möglich, durch CI-Checks erzwungen — nicht durch Disziplin.

| # | Regel | Erzwungen durch |
|---|---|---|
| R1 | `src/domain/**` importiert nichts aus React, Next.js oder Supabase | ESLint `no-restricted-imports` |
| R2 | `supabase-js` erscheint nicht in `src/components/**` und nicht in `src/app/**` (ausser in `lib/supabase`) | ESLint |
| R3 | Der `service_role`-Key wird ausschliesslich in `lib/supabase/admin.ts` gelesen | ESLint + CI-Grep |
| R4 | Jede Tabelle in `public` hat `ROW LEVEL SECURITY` **und** `FORCE ROW LEVEL SECURITY` | Integrationstest gegen lokale DB |
| R5 | `organization_id` wird bei INSERT nie aus Client-Input übernommen | DB-`DEFAULT` + `WITH CHECK`-Policy |
| R6 | Keine hartcodierten Anzeigetexte in Komponenten | ESLint `no-literal-string` (nur `src/features`, `src/components`) |
| R7 | Jede Server Action validiert ihren Input mit Zod, auch wenn der Client bereits validiert hat | Code-Review + Action-Wrapper |
| R8 | Logger nimmt nur IDs und Enums entgegen, keine Freitexte und keine Personendaten | Typsignatur des Loggers |

---

## 2. Schichtenmodell

```
┌───────────────────────────────────────────────────────────┐
│ UI            React-Komponenten, shadcn/ui, Tailwind      │
│               kennt nur Props, Hooks und Übersetzungen    │
├───────────────────────────────────────────────────────────┤
│ Application   Server Actions · Command-Handler · Queries  │
│               Auth-Prüfung, Autorisierung, Orchestrierung │
├───────────────────────────────────────────────────────────┤
│ Domain        reines TypeScript, framework-frei           │
│               Statusmodell · Abschlussregeln · Vorsorge   │
│               Summary-Erzeugung · Zod-Schemas             │
├───────────────────────────────────────────────────────────┤
│ Infrastructure  Supabase-Repositories · Storage · PDF     │
│                 Mail-Adapter · Export                     │
└───────────────────────────────────────────────────────────┘
```

**Abhängigkeitsregel:** Pfeile zeigen ausschliesslich nach innen. Das Domain-Layer kennt weder
Datenbank noch UI. Infrastruktur implementiert Interfaces, die im Domain-Layer definiert sind
(Ports & Adapters, aber ohne Zeremonie — ein Interface und eine Implementierung, kein
DI-Container).

**Warum das hier wirklich zählt:** Die geforderten Tests (Punkt 35 des Konzepts — Beratungsstatus,
Vorsorgeberechnung, Abschlussregeln, Zusammenfassung) laufen damit als schnelle Unit-Tests ohne
Datenbank und ohne React. Das ist der einzige Grund für diese Trennung; sie ist kein Selbstzweck.

---

## 3. Ordnerstruktur

```
src/
  app/                          Next.js App Router — nur Routing, Layout, Rendering
    (marketing)/                öffentlich: Landing, Preise, Datenschutz
    (auth)/                     Login, Registrierung, Einladung annehmen
    (app)/                      angemeldet, mit Navigationsshell
      dashboard/
      customers/[customerId]/
      advice/                   Beratungsübersicht (Liste)
      tasks/
      policies/
      settings/                 Organisation, Benutzer, Branding, Sparten
    (advisor)/                  Beratungsmodus — eigenes Layout OHNE Navigation
      advice/[sessionId]/
    api/
      advice/sync/              Outbox-Batch-Endpunkt
      documents/[documentId]/   signierter Download
      v1/                       öffentliche API (reserviert, Phase 3)

  components/
    ui/                         shadcn/ui-Primitives (angepasste Grössen-Tokens)
    charts/                     AdviceWheel, GapChart — domänenfrei parametrisiert
    layout/

  features/                     vertikale Schnitte; hier liegt der Anwendungscode
    customers/{components,actions.ts,queries.ts,schemas.ts}
    advice/{components,commands/,actions.ts,queries.ts}
    policies/
    pension/
    tasks/
    documents/
    settings/

  domain/                       framework-frei, vollständig unit-testbar
    advice/{status.ts,completion.ts,progress.ts,summary.ts,commands.ts,types.ts}
    pension/{calculator.ts,parameters.ts,types.ts}
    customer/
    policy/
    shared/{result.ts,ids.ts,money.ts,date.ts}
    ports/{pdf.ts,mail.ts,storage.ts,export.ts}

  lib/
    supabase/{client.ts,server.ts,middleware.ts,admin.ts,types.ts}
    sync/{outbox.ts,syncEngine.ts,db.ts}
    i18n/
    auth/{session.ts,permissions.ts}
    logger.ts
    env.ts

  services/                     Adapter — implementieren domain/ports
    pdf/  mail/  storage/  export/

  types/
    database.generated.ts       via `supabase gen types`, eingecheckt

supabase/
  migrations/                   fortlaufend nummeriert, nie nachträglich geändert
  seed/                         Spartenkatalog, Demo-Organisation
  tests/                        RLS- und Constraint-Tests

tests/
  e2e/                          Playwright, drei kritische Pfade

docs/
```

**Zur Abgrenzung `features/` vs. `domain/`:** In `features/` liegt alles, was Next.js, Supabase
oder React braucht. In `domain/` liegt nur, was auch in einem Node-Skript ohne Framework laufen
würde. Faustregel: Wenn eine Funktion getestet werden soll, ohne eine Datenbank zu starten, gehört
sie nach `domain/`.

---

## 4. Frontend-Architektur

### 4.1 Rendering-Strategie

| Bereich | Rendering | Begründung |
|---|---|---|
| Marketing | statisch | öffentlich, cachebar |
| Auth | dynamisch | Cookies |
| App-Shell (Dashboard, Listen) | React Server Components, `force-dynamic` | Tenant-Daten, nie cachen |
| Beratungsmodus | Client Component Island | braucht lokalen Zustand und Outbox |
| PDF-Erzeugung | Node-Runtime Route Handler | kein Edge (Schriftarten, Speicher) |

**Sicherheitsregel:** Jedes Layout unterhalb von `(app)` und `(advisor)` setzt
`export const dynamic = 'force-dynamic'`. Tenant-Daten dürfen nie in den Full Route Cache geraten
(siehe Analyse 2.3). `unstable_cache` wird für Tenant-Daten nicht verwendet — Ausnahme wäre der
Spartenkatalog, der tenant-unabhängig ist.

### 4.2 Zwei Oberflächen, eine Anwendung

Punkt 25 des Konzepts verlangt einen navigationsfreien Beratungsmodus. Das wird als eigene Route
Group `(advisor)` mit eigenem Layout umgesetzt — nicht als Zustandsflag in der App-Shell. Vorteile:
kein Durchsickern von Navigationselementen, eigene Fehler- und Ladezustände, und der Modus ist als
Vollbild-Präsentation direkt verlinkbar.

Layout des Beratungsmodus:

```
┌────────────────────────────────────────────────────────┐
│  Max Muster & Anna Muster        ●●●●●○○○○  8 / 14  ✕  │  Kopfzeile: Kunde, Fortschritt, Beenden
├────────────────────────────────────────────────────────┤
│                                                        │
│                   Arbeitsbereich                       │  Rad ODER Sparte ODER Vorsorge
│                                                        │
├────────────────────────────────────────────────────────┤
│  ‹ Zurück          ◉ Beratungsrad          Weiter ›    │  Fusszeile: konstante Navigation
└────────────────────────────────────────────────────────┘
```

Es gibt genau drei Ansichtstypen im Arbeitsbereich: Rad/Liste (Übersicht), Sparte (Detail),
Sonderansichten (Vorsorge, Abschluss). Mehr nicht — jede zusätzliche Ebene macht die Bedienung im
Gespräch unsicher.

### 4.3 Beratungsrad

Handgeschriebenes SVG, keine Chart-Bibliothek (Begründung in der Analyse 2.12). Anforderungen:

- Jedes Segment ist ein `<g role="button" tabIndex={0}>` mit `aria-label` (Spartenname + Status),
  Tastaturbedienung mit Pfeiltasten.
- Status wird **doppelt kodiert**: Farbe **und** Symbol. Farbe allein genügt nicht — rot/grün ist
  für einen relevanten Teil der Nutzer und deren Kunden nicht unterscheidbar, und das Rad wird dem
  Kunden gezeigt.
- Minimale Trefferfläche 44 × 44 px. Bei mehr als 16 Sparten schaltet die Komponente automatisch auf
  die Listenansicht um, statt die Segmente weiter zu verkleinern.
- Die Komponente ist domänenfrei: sie bekommt `{ id, label, status, color }[]` und einen
  `onSelect`-Callback. Keine Kenntnis von Versicherungen.

### 4.4 State-Management — drei Kategorien, klar getrennt

| Kategorie | Werkzeug | Beispiel |
|---|---|---|
| Server-Zustand | TanStack Query | Kundenliste, Aufgaben, Policen |
| Beratungs-Sessionzustand | lokaler Reducer + Outbox (`lib/sync`) | offene Sparte, Statusänderungen, Notizen |
| UI-/Filterzustand | URL-Suchparameter | aktive Sparte, Listenfilter, Sortierung |

**Keine globale State-Bibliothek darüber hinaus.** Kein Redux, kein Zustand-Store für alles. Der
Beratungszustand ist der einzige komplexe Client-Zustand und wird bewusst lokal in einem Reducer
gehalten, weil er ohnehin serialisiert werden muss.

Der aktive Sparten-Tab steht in der URL, damit ein versehentlicher Neuladen im Gespräch an derselben
Stelle landet.

### 4.5 Formulare und Validierung

React Hook Form mit `zodResolver`. Die Schemas leben in `domain/*/schemas.ts` (fachliche Regeln) und
werden im Feature-Layer nur um UI-spezifische Aspekte erweitert. Damit gilt **dasselbe Schema** im
Browser und auf dem Server — der Server validiert trotzdem erneut (R7), weil Client-Validierung
eine Bequemlichkeit ist, keine Sicherheitsmassnahme.

Formular-Konventionen für das iPad: `autoComplete` korrekt gesetzt, `inputMode="decimal"` für
Beträge, Datumsfelder als natives `date` mit Textfallback, kein Modal-in-Modal, Speicherung
automatisch beim Verlassen des Feldes (kein „Speichern"-Knopf im Beratungsmodus).

### 4.6 Design-System

shadcn/ui als Basis, aber mit angepassten Grössen-Tokens: Die Standardgrössen sind für
Desktop-Maus ausgelegt. Für `(advisor)` gilt eine eigene Dichte-Stufe (grössere Zeilenhöhen,
Mindesthöhe 48 px für interaktive Elemente, grössere Schrift). Das wird einmal zentral über
CSS-Variablen und eine `data-density`-Auszeichnung am Layout gelöst, nicht durch punktuelle
Klassen-Overrides.

Farbsemantik der Beratungsstatus wird einmal in `lib/statusTokens.ts` definiert und von Rad, Liste,
Badges und PDF gemeinsam genutzt — damit das gedruckte Protokoll dieselbe Sprache spricht wie der
Bildschirm.

---

## 5. Beratungsmodus: Command-Pipeline (Kernstück, ADR-002)

Das ist der architektonisch anspruchsvollste Teil und der Grund, warum Mutationen nicht als
verstreute Server Actions geschrieben werden.

### 5.1 Ablauf

```
  UI-Interaktion
        │
        ▼
  Command erzeugen  { id: uuid (Client), sessionId, type, payload, clientSeq, clientTs }
        │
        ├──────────────► optimistischer Reducer ──► UI aktualisiert sofort
        │
        ▼
  Outbox (IndexedDB)  — überlebt Tab-Absturz und Netzverlust
        │
        ▼
  Sync-Engine  ──POST /api/advice/sync──►  Server
        │                                    │ Zod-Validierung
        │                                    │ Autorisierung (Session gehört zum Tenant?)
        │                                    │ Idempotenz: advice_command_log
        │                                    │ Domain-Handler wendet an
        │◄────── { applied: [ids], rejected: [{id, reason}] }
        ▼
  Outbox bereinigen · bei Ablehnung: UI-Korrektur + Hinweis
```

### 5.2 Entwurfsentscheidungen

**Idempotenz statt Transaktionsklammer.** Jedes Command trägt eine client-generierte UUID. Der
Server schreibt sie in `advice_command_log` mit `ON CONFLICT DO NOTHING`. Ein Retry nach
Netzabbruch kann damit nie doppelt anwenden — ohne verteilte Transaktionen.

**Reihenfolge pro Session, nicht global.** Commands tragen eine aufsteigende `clientSeq` je Session
und werden in dieser Reihenfolge angewendet. Das genügt, weil eine Beratung faktisch von einem
Gerät bearbeitet wird.

**Konfliktstrategie: bewusst einfach.** Last-write-wins auf Feldebene. Eine echte Konfliktauflösung
(CRDT, Merge-Dialoge) wäre hier überdimensioniert. Stattdessen: `advice_sessions.active_device_id`
und `active_device_seen_at`. Öffnet ein zweites Gerät dieselbe Beratung, erscheint ein deutlicher
Hinweis, und das zweite Gerät startet schreibgeschützt, bis der Nutzer die Übernahme bestätigt.
Das löst 95 % der realen Fälle mit 5 % des Aufwands.

**Der Abschluss läuft nicht über die Outbox.** `COMPLETE_SESSION` ist eine reguläre, verbindungs-
pflichtige Server Action: Sie erzeugt Snapshot, Hash und PDF und braucht dafür Server und Storage.
Wenn das Netz fehlt, muss der Berater das ehrlich angezeigt bekommen — ein „optimistisch
abgeschlossenes" Protokoll wäre fachlich falsch.

**Datenschutz der Outbox.** Nur die laufende Session, gelöscht nach Bestätigung und beim Logout,
niemals `localStorage`. Die Abweichung von Konzeptpunkt 22 ist bewusst und gehört dokumentiert
(ADR-002, sowie später ins Bearbeitungsverzeichnis und die TOM-Beschreibung).

### 5.3 Command-Typen (erste Fassung)

```
SESSION_START · SESSION_SET_PARTICIPANTS
TOPIC_SET_PROGRESS · TOPIC_SET_OUTCOME · TOPIC_SET_PRIORITY
NOTE_UPSERT · NOTE_DELETE                     (mit visibility INTERNAL | SHARED)
POLICY_UPSERT · POLICY_DELETE
TASK_UPSERT · TASK_DELETE
PENSION_INPUT_UPSERT                          (scenario: ACCIDENT | ILLNESS)
```

Jeder Typ hat ein Zod-Schema und einen reinen Handler in `domain/advice/commands.ts`, der aus
`(Zustand, Command)` einen neuen Zustand berechnet. **Derselbe Handler läuft im Browser
(optimistisch) und auf dem Server (autoritativ).** Das ist der eigentliche Gewinn der Trennung: Die
Logik existiert genau einmal.

---

## 6. Backend-Architektur

### 6.1 Kein eigenes Backend

Next.js Server Actions und Route Handler genügen. Ein separater Dienst wäre für dieses Produkt
Ballast (Analyse 1.8).

| Mechanismus | Wofür | Warum nicht anders |
|---|---|---|
| Server Actions | Formular-Mutationen (Kunde anlegen, Aufgabe, Einstellungen) | Typsicher, kein API-Boilerplate |
| Route Handler | `/api/advice/sync`, Dokumenten-Download, Webhooks, öffentliche API | Braucht echtes HTTP: Retry, Batching, Statuscodes, Fremdaufrufer |
| Postgres-Funktionen | Abschluss-Transaktion, Audit-Trigger, RLS-Helfer | Muss atomar und unumgehbar sein |

### 6.2 Einheitliches Muster für Server Actions

Jede Action durchläuft dieselben Schritte, gekapselt in einem dünnen Wrapper:

```ts
// Skizze — die tatsächliche Implementierung folgt in Phase 0
export const createCustomer = action
  .input(createCustomerSchema)            // 1. Zod-Validierung
  .permission('customer:create')          // 2. Rolle prüfen
  .handler(async ({ input, ctx }) => {    // ctx: { userId, organizationId, role }
    const customer = buildCustomer(input, ctx)   // 3. Domain
    return customerRepository.insert(customer)   // 4. Infrastruktur
  })
```

Der Wrapper ist bewusst schmal: Validierung, Auth-Kontext, Berechtigung, Fehlerabbildung,
Revalidierung. Keine Middleware-Kette, keine Plugin-Architektur.

### 6.3 Der Beratungsabschluss als Datenbanktransaktion

Der kritischste Vorgang im System. Ablauf in einer Postgres-Funktion, damit er atomar ist:

1. Prüfen: Gehört die Session zum Tenant, ist sie noch offen?
2. Domain-Prüfung `canCompleteSession` (vorher im Anwendungscode, mit klarer Fehlerliste ans UI).
3. Snapshot-JSON schreiben, SHA-256 berechnen.
4. `advice_sessions.status = COMPLETED`, `completed_at`, `snapshot_id` setzen.
5. Ab jetzt sperrt ein Trigger jede weitere Änderung an Session und zugehörigen Topics.

PDF-Erzeugung und Signatur laufen **danach** und asynchron zum Abschluss selbst — sie sind
Darstellungen des Snapshots, keine Voraussetzung. Fehlt das PDF, kann es neu erzeugt werden; der
rechtlich relevante Zustand ist der Snapshot mit Hash.

---

## 7. Authentifizierung

### 7.1 Aufbau

Supabase Auth mit E-Mail/Passwort und Magic Link. TOTP-MFA ab Phase 1 verfügbar, für Owner- und
Admin-Rollen per Organisationseinstellung erzwingbar (Analyse 2.12).

**Custom Access Token Hook** reichert das JWT an:

```
{
  sub: <user_id>,
  app_metadata: {
    organization_id: <uuid>,      // aktive Organisation
    organization_role: 'ADVISOR', // Rolle in dieser Organisation
    member_id: <uuid>
  }
}
```

Damit arbeiten RLS-Policies gegen einen Claim statt gegen einen Subselect (Analyse 2.1).

### 7.2 Mehrfachzugehörigkeit und Organisationswechsel

Ein Nutzer kann mehreren Organisationen angehören. `profiles.active_organization_id` bestimmt die
aktive; ein expliziter Wechsel-Endpunkt setzt sie und erzwingt einen Token-Refresh. Es gibt keinen
impliziten Wechsel und keine „erste Organisation aus der Liste"-Logik — das wäre eine
Datenleck-Quelle.

### 7.3 Einladungen

`invitations` mit Einmal-Token, Ablaufdatum, Zielrolle und Organisation. Annahme erzeugt
`organization_members` in einer Transaktion und invalidiert das Token. Kein Selbstbeitritt über
E-Mail-Domain — bei Broker-Daten zu riskant.

### 7.4 Middleware

Refresht die Supabase-Session und schützt `(app)` und `(advisor)`. Wichtig und erfahrungsgemäss
fehleranfällig: Die aktualisierten Cookies müssen sowohl auf das Request- als auch auf das
Response-Objekt geschrieben werden, sonst laufen Server Components mit einem abgelaufenen Token.

---

## 8. Multi-Tenancy und Row Level Security

### 8.1 Grundregeln

1. Jede fachliche Tabelle hat `organization_id uuid NOT NULL REFERENCES organizations(id)`.
2. `organization_id` kommt **nie** aus Client-Input. Spalten-`DEFAULT auth_org_id()` plus
   `WITH CHECK (organization_id = auth_org_id())`.
3. `ROW LEVEL SECURITY` **und** `FORCE ROW LEVEL SECURITY` auf allen Tabellen. Ohne `FORCE` umgeht
   der Tabelleneigentümer sämtliche Policies — ein häufig übersehener Punkt.
4. Policies werden **generiert**, nicht 20-mal von Hand geschrieben.

### 8.2 Hilfsfunktionen

```sql
create or replace function public.auth_org_id() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'organization_id', ''
  )::uuid
$$;

create or replace function public.auth_org_role() returns text
  language sql stable security definer set search_path = ''
as $$ ... $$;
```

`stable` sorgt dafür, dass der Planer die Funktion je Query einmal auswertet statt je Zeile —
entscheidend für die Performance der Policies.

### 8.3 Policy-Generator

Eine Migration iteriert über alle Tabellen mit einer `organization_id`-Spalte und erzeugt vier
Policies (select/insert/update/delete) nach identischem Muster. Neue Tenant-Tabellen werden durch
erneutes Ausführen des Generators abgedeckt. Ergebnis: kein Copy-Paste, keine Tippfehler mit
Datenleck-Folge.

Rollenabhängige Einschränkungen (z. B. Backoffice darf keine Beratung abschliessen) laufen **nicht**
über zusätzliche Policies pro Rolle, sondern über eine Funktion `has_permission(role, action)`, die
im `USING`/`WITH CHECK` verwendet wird. Damit bleibt das Rechtesystem an einer Stelle und kann
später verfeinert werden, ohne alle Policies anzufassen (Konzeptpunkt 20).

### 8.4 Absicherung durch Tests

Zwei generische Integrationstests gegen eine lokale Supabase-Instanz:

- **Vollständigkeitstest:** Liest `pg_tables` und `pg_class` und stellt sicher, dass jede Tabelle in
  `public` RLS und FORCE RLS aktiv hat und mindestens eine Policy besitzt. Eine neue Tabelle ohne
  Policy bricht damit automatisch den Build.
- **Isolationstest:** Zwei echte Nutzer in zwei Organisationen. Für **jede** Tabelle wird versucht,
  fremde Zeilen zu lesen, zu ändern, zu löschen und mit fremder `organization_id` einzufügen.
  Erwartung: null Zeilen bzw. Fehler.

Diese beiden Tests sind der wichtigste Sicherheitsmechanismus des Projekts und entstehen in Phase 0,
nicht später (Analyse 2.11).

### 8.5 Der `service_role`-Key

Gekapselt in `lib/supabase/admin.ts`, verwendet nur für: Organisationserstellung bei der
Registrierung (bevor eine Mitgliedschaft existiert), eingehende Webhooks, Wartungsjobs. Jeder
Aufruf schreibt einen Audit-Eintrag mit Begründungs-Enum. ESLint und ein CI-Grep verbieten den
Import ausserhalb dieser Datei (R3).

---

## 9. Storage

### 9.1 Buckets

| Bucket | Inhalt | Öffentlich |
|---|---|---|
| `documents` | Policen-PDFs, Kundendokumente | nein |
| `advice-exports` | erzeugte Beratungsprotokolle | nein |
| `signatures` | Kundenunterschriften (PNG) | nein |
| `branding` | Firmenlogos für das PDF | nein |

Es gibt keinen öffentlichen Bucket. Auch das Firmenlogo nicht — es ist ein Kundenasset.

### 9.2 Pfadschema und Policy

```
{organization_id}/{customer_id}/{document_id}.{ext}
```

RLS auf `storage.objects` prüft das erste Pfadsegment gegen `auth_org_id()`. Damit ist die
Tenant-Isolation im Storage genauso durchgesetzt wie in der Datenbank — nicht nur über die
Anwendungslogik.

### 9.3 Upload- und Download-Regeln

- Upload über eine vom Server erzeugte signierte Upload-URL; der Client lädt nie mit einem
  Schlüssel hoch.
- Download ausschliesslich über kurzlebige signierte URLs (60 Sekunden), erzeugt in einem Route
  Handler nach Berechtigungsprüfung.
- MIME-Whitelist (PDF, JPEG, PNG, HEIC), Grössenlimit 20 MB, Prüfung serverseitig anhand der
  Magic Bytes, nicht anhand des vom Client gemeldeten Typs.
- Der Originaldateiname wird **nicht** als Pfad verwendet (Path Traversal, Sonderzeichen), sondern
  nur als Metadatum in der Datenbank gespeichert.
- Virenprüfung ist im MVP nicht vorgesehen; das ist eine bewusste, dokumentierte Restrisiko-
  Entscheidung (Broker laden fremde Dateien hoch).

---

## 10. Domain Model

### 10.1 Aggregate

| Aggregat | Wurzel | Enthält | Invariante |
|---|---|---|---|
| Organisation | `organizations` | Mitglieder, Einstellungen, Spartenauswahl | Mindestens ein Owner |
| Kunde | `customers` | Personen, Adressen, Einwilligungen | Mindestens eine Person |
| Beratung | `advice_sessions` | Topics, Notizen, Vorsorgeanalyse, Teilnehmer | Abschluss nur bei vollständigen Topics |
| Vertrag | `policies` | Dokumente | Gehört zu Kunde und Sparte |
| Aufgabe | `tasks` | — | Verantwortlicher gesetzt |
| Beratungsvorlage | `advice_template_versions` | Topic-Konfiguration | Unveränderlich nach Veröffentlichung |
| Snapshot | `advice_session_snapshots` | vollständiges Protokoll-JSON | Unveränderlich, Hash gesichert |

Der zentrale Aggregat-Grundsatz: **Die Beratung ist die einzige Entität mit echten Invarianten.**
Alles andere sind im Wesentlichen CRUD-Datensätze mit Tenant-Bezug und verdient keine
Domänenzeremonie.

### 10.2 Statusmodell (löst Konzeptpunkt 28)

Zwei unabhängige Dimensionen statt eines vermischten Enums (Analyse 2.9):

```
progress_status   NOT_STARTED → IN_PROGRESS → DISCUSSED
                                            ↘ SKIPPED

outcome (nullable, erst ab DISCUSSED erlaubt)
   NO_ACTION_NEEDED · ACTION_REQUIRED · OFFER_REQUESTED
   CONTRACT_REQUESTED · FOLLOW_UP · CLIENT_DECLINED
```

Erlaubte Übergänge und die Bedingung „`outcome` nur gesetzt, wenn `progress_status = DISCUSSED`"
werden **doppelt** durchgesetzt: als reine Funktion in `domain/advice/status.ts` (testbar) und als
CHECK-Constraint in der Datenbank (unumgehbar).

Daraus folgt die zentrale Produktregel als prüfbare Funktion:

```
canCompleteSession(session, templateVersion)
  → ok
  | { missing: TopicRef[] }   // aktive Topics ohne outcome und ohne SKIPPED
```

Das ist der Kern des Produktversprechens „kein Bereich wird vergessen" — und damit der
wichtigste Testfall im gesamten System.

### 10.3 Die Zusammenfassung: einmal berechnet, dreifach gerendert

```
           AdviceSession + Policies + Pension + Tasks
                            │
                    buildSummary()            reine Funktion
                            │
                   SummaryDocument            versioniertes, validiertes Objekt
                    ┌───────┼───────┐
                    ▼       ▼       ▼
                  PDF    E-Mail   JSON/CSV (CRM)
```

`SummaryDocument` ist zugleich das, was beim Abschluss als Snapshot eingefroren wird. Ein
Datenmodell, eine Berechnung, drei Darstellungen — statt drei Stellen, die dieselbe Zusammenfassung
leicht unterschiedlich zusammenbauen. Die Filterung interner Notizen (Analyse 1.6) passiert genau
hier, an einer Stelle.

### 10.4 Vorsorgeberechnung

```
domain/pension/
  types.ts        PensionScenario = 'ACCIDENT' | 'ILLNESS' | 'DEATH' | 'RETIREMENT'
  parameters.ts   Zugriff auf legal_parameters nach Gültigkeitsjahr
  calculator.ts   calculateGap(input, parameters) → GapResult
```

Verbindliche Eigenschaften:

- **Unfall und Krankheit sind getrennte Szenarien** (Analyse 1.5). Kein gemeinsamer Topf.
- Die Funktion ist rein: gleiche Eingabe, gleiches Ergebnis — auch in fünf Jahren.
- Gesetzliche Parameter werden als Argument übergeben, nie importiert. Jede gespeicherte Analyse
  merkt sich das verwendete Parameterjahr.
- Beträge als Ganzzahl in Rappen (`money.ts`), nie als Float. Rundungsfehler in einer
  Versorgungslücke sind fachlich inakzeptabel.
- Das Ergebnis trägt eine `confidence`-Kennzeichnung und die Liste der Annahmen, die im PDF
  mitgedruckt werden.

---

## 11. Validierung

- **Eine Quelle:** Zod-Schemas in `domain/*/schemas.ts`. Daraus werden die TypeScript-Typen
  abgeleitet (`z.infer`), nicht umgekehrt.
- **Datenbanktypen** werden mit `supabase gen types typescript` generiert, eingecheckt, und ein
  CI-Schritt prüft auf Drift zwischen Migrationen und generierten Typen.
- **Mapper** zwischen Datenbankzeile und Domänenobjekt liegen im Repository. Die Domäne kennt keine
  `snake_case`-Spalten.
- **Dreifache Absicherung** bei kritischen Regeln: Zod (Eingabe), Domänenfunktion (Logik),
  DB-Constraint (letzte Instanz). Für unkritische Felder genügt Zod — R7 verlangt Validierung, nicht
  Redundanz um jeden Preis.

---

## 12. Services und Ports

Interfaces in `domain/ports`, Implementierungen in `services/`:

| Port | MVP-Implementierung | Später |
|---|---|---|
| `PdfRenderer` | `@react-pdf/renderer` | unverändert |
| `MailSender` | `PreparedMailSender` — erzeugt Entwurf, kein Versand | Microsoft 365 · Gmail · SMTP |
| `DocumentStorage` | Supabase Storage | S3-kompatibel bei Umzug |
| `ExportTarget` | JSON- und CSV-Export | Bexio · HubSpot · Webhooks |
| `AuditSink` | Postgres-Trigger (Standard) + expliziter Sink für Nicht-DB-Ereignisse | unverändert |

Genau ein Interface plus eine Implementierung pro Port. Keine Fabriken, keine Registry, kein
DI-Container — der Zweck ist Austauschbarkeit an der Grenze, nicht Abstraktion als Selbstzweck
(Konzeptpunkt 34: keine übertriebenen Abstraktionen).

Die Mail-Architektur des MVP: `PreparedMailSender` liefert Betreff und Text zurück, die Anwendung
zeigt sie zur Bearbeitung an und bietet Kopieren sowie `mailto:`. Der Wechsel auf echten Versand ist
später ein Adaptertausch, keine Umstellung (Konzeptpunkt 13). Empfohlen für den späteren Versand:
Protokoll nicht als Anhang, sondern als tokenisierter Downloadlink mit Ablauf (Analyse 2.12).

---

## 13. API-Struktur und Integrationen

Für das MVP nicht gebaut, aber das Schema wird jetzt reserviert, damit es später nicht bricht:

```
/api/v1/customers          GET, POST
/api/v1/advice-sessions    GET
/api/v1/advice-sessions/:id/summary   GET   → SummaryDocument als JSON
/api/v1/tasks              GET, POST
/api/v1/webhooks/endpoints CRUD
```

Authentifizierung später über Organisations-API-Keys (gehasht gespeichert, Präfix sichtbar),
niemals über Nutzer-JWTs. Ausgehende Webhooks mit HMAC-Signatur und Zustellversuchs-Protokoll.
Ereignisnamen ab jetzt festgelegt, weil sie Vertragsbestandteil werden:
`advice_session.completed`, `task.created`, `policy.expiring`.

---

## 14. Betrieb, Protokollierung, Datenschutz

- **Umgebungsvariablen** zentral in `lib/env.ts` mit Zod validiert, Fehlschlag beim Start statt
  `undefined` zur Laufzeit. Getrennte Schemas für Server und Client; der Client kennt nur
  `NEXT_PUBLIC_*`.
- **Protokollierung mit PII-Schutz:** Die Signatur des Loggers nimmt ausschliesslich IDs, Enums und
  Zahlen entgegen (R8). Kundennamen, Notizen, Einkommen und Diagnosen dürfen die Anwendung nie
  verlassen. Das ist bei Fehlerberichten die realistischste Leckquelle.
- **Audit-Log per Trigger** auf den relevanten Tabellen: vollständig, unumgehbar, kaum Code
  (Analyse 2.12). Nur `INSERT`-Policy, keine `UPDATE`/`DELETE`-Policy — auch nicht für Owner.
  Lesen darf Owner und Admin.
- **Soft-Delete** (`deleted_at`) statt physischem Löschen bei Beratungen, Protokollen und Kunden;
  Anonymisierungsfelder vorbereitet (Analyse 1.10).
- **Region:** Supabase-Projekt in einer europäischen Region, Vercel-Functions auf Frankfurt gepinnt.
  Endgültige Festlegung mit offenem Punkt O-2.
- **Backup:** Tägliche automatische Sicherung durch Supabase plus ein wöchentlicher, extern
  abgelegter logischer Dump. Ein Restore-Test gehört einmal in Phase 7 durchgeführt und
  protokolliert — eine ungetestete Sicherung ist keine Sicherung.

---

## 15. Test-Architektur

| Ebene | Werkzeug | Umfang | Gegenstand |
|---|---|---|---|
| Unit | Vitest | hoch | `src/domain/**`: Status, Abschluss, Vorsorge, Summary, Command-Handler |
| Integration DB | Vitest + lokale Supabase | vollständig für RLS | Tenant-Isolation, Constraints, Abschluss-Trigger |
| Integration App | Vitest | selektiv | Server Actions inkl. Berechtigungen |
| E2E | Playwright | drei Pfade | Login → Kunde → Beratung durchklicken → Abschluss → PDF |
| Statisch | tsc, ESLint | vollständig | Regeln R1–R8 |

CI-Reihenfolge: `typecheck → lint → unit → db-integration → build → e2e`. Die Datenbanktests laufen
gegen `supabase start` im Container und sind nicht optional — sie sind der Isolationsnachweis.

---

## 16. Bewusst nicht gebaut

Der Vollständigkeit halber, damit später nicht darüber diskutiert wird:

- Kein Monorepo, kein Turborepo, keine geteilten Pakete.
- Kein tRPC oder GraphQL — Server Actions und Zod decken den Bedarf.
- Kein ORM mit eigenem Migrationsmechanismus neben Supabase-Migrationen (zwei Wahrheiten für ein
  Schema sind eine Fehlerquelle ohne Gegenwert).
- Kein Event Sourcing. Die Command-Pipeline ist ein Transportmechanismus, keine Quelle der Wahrheit;
  der Zustand liegt in normalisierten Tabellen.
- Kein DI-Container, keine Repository-Interfaces für Entitäten ohne zweite Implementierung.
- Keine Micro-Frontends, keine Feature-Flag-Infrastruktur, kein eigenes Design-System.
- Keine Realtime-Synchronisation zwischen Beratern — das Produkt ist Einzelplatz pro Gespräch.

---

## 17. Was diese Architektur für die spätere Erweiterung offen hält

| Spätere Anforderung | Vorbereitung in dieser Architektur |
|---|---|
| Firmenkunden (Punkt 17) | Beratungsvorlagen; `customers` als Mandantenklammer |
| CRM-Anbindung (Punkt 15) | `ExportTarget`-Port; reserviertes `/api/v1`; `SummaryDocument` als stabiles Austauschformat |
| Echter Mailversand (Punkt 13) | `MailSender`-Port |
| OCR und AI (Punkt 32) | Dokumente liegen strukturiert im Storage; Policenfelder sind bereits typisiert — ein AI-Vorschlag füllt dasselbe Zod-Schema |
| Billing (Punkt 31) | `organizations.plan` und `seats` im Schema vorgesehen, Stripe als späterer Adapter |
| Umzug in die Schweiz (Punkt 22) | Repository-Schicht, kein `supabase-js` in der UI, sparsame Nutzung proprietärer Funktionen |
| Feineres Rechtesystem (Punkt 20) | `has_permission(role, action)` an einer Stelle statt Rollenprüfungen in 40 Policies |
