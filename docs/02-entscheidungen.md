# Entscheidungsprotokoll (ADR-Kurzform)

Fortlaufendes Protokoll der getroffenen Produkt- und Architekturentscheidungen.
Jede Entscheidung wird mit Datum, Begründung und Konsequenz festgehalten.

---

## ADR-001 — Kundensignatur und PDF-Protokoll kommen in MVP Phase 1
**Datum:** 2026-09-14 · **Status:** entschieden

**Entscheidung:** PDF-Export, Einfrieren der abgeschlossenen Beratung (Snapshot + Hash) und die
Touch-Unterschrift des Kunden auf dem iPad sind Bestandteil von MVP Phase 1. Im Gegenzug wird das
Vertragsmodul in Phase 1 abgespeckt (Pflichtfelder nur Versicherer, grobe Prämie, optional Ablauf
und Kündigungsfrist; alle weiteren Felder optional und eingeklappt). Der Offertvergleich bleibt in
Phase 2.

**Begründung:** Der gesamte wahrgenommene Produktnutzen entsteht im Output am Ende des Gesprächs.
Ohne PDF gibt es nichts, was der Berater dem Kunden übergibt — das MVP wäre weder demonstrierbar
noch verkaufbar. Die vom Kunden bestätigte Dokumentation einer ausdrücklichen Ablehnung ist
zugleich das stärkste Differenzierungsmerkmal gegenüber Notizen in Word oder im CRM.

**Konsequenz:** `@react-pdf/renderer` in der Node-Runtime statt Headless Chromium. Erzeugte PDFs
werden gespeichert, nicht bei jedem Abruf neu gerendert. Signatur als PNG im Storage, referenziert
vom Snapshot. Die Touch-Unterschrift ist keine qualifizierte elektronische Signatur nach ZertES;
das ist im UI und im PDF transparent zu kennzeichnen.

---

## ADR-002 — Sync-Outbox für den Beratungsmodus
**Datum:** 2026-09-14 · **Status:** entschieden

**Entscheidung:** Alle Mutationen im Beratungsmodus laufen über eine lokale Outbox (IndexedDB) und
werden von dort asynchron mit Retry synchronisiert. Der Sync-Status ist im UI sichtbar. Die Outbox
enthält ausschliesslich die laufende Beratungssession, nie die Kundendatenbank, und wird nach
erfolgreicher Synchronisation sowie beim Logout gelöscht.

**Begründung:** Der Berater arbeitet beim Kunden vor Ort in fremden oder fehlenden Netzen. Ein
Datenverlust mitten im Gespräch verbrennt das Produkt beim Berater dauerhaft — dieser Vorfall
passiert pro Account genau einmal. Nachträglich ist das nicht einzuziehen, weil es die gesamte
Mutationsschicht betrifft.

**Konsequenz:**
- Beratungsmutationen werden als serialisierbare, benannte Kommandos modelliert (nicht als
  verstreute Server-Action-Aufrufe in Komponenten).
- Alle Schreibvorgänge sind idempotent: client-generierte UUIDs, Upsert-Semantik, damit Retry nicht
  dupliziert.
- Abgrenzung zu Punkt 22 des Konzepts ("keine sensiblen Daten im Client LocalStorage"): kein
  `localStorage` für Nutzdaten; IndexedDB nur für die laufende Session, mit definierter Löschung.
  Diese Abgrenzung gehört ins Bearbeitungsverzeichnis und in die TOM-Beschreibung.
- Kein Anspruch auf volle Offline-Fähigkeit: Kundenliste und Stammdaten brauchen weiterhin Netz.

---

## ADR-003 — Kundenmodell mit Haushalt/Mandant und Personen
**Datum:** 2026-09-14 · **Status:** entschieden

**Entscheidung:** `customers` ist die Klammer (Mandant: Haushalt, Paar, Familie oder — später —
Unternehmen). Die natürlichen Personen liegen darunter in `customer_persons`. Verträge,
Vorsorgeanalysen und Beratungsergebnisse referenzieren optional eine konkrete Person; ohne
Personenbezug gelten sie für den gesamten Haushalt.

**Begründung:** Paar und Familie sind der Normalfall, nicht die Ausnahme. Hausrat und
Privathaftpflicht gehören dem Haushalt, Säule 3a und Erwerbsunfähigkeit einer einzelnen Person, und
bei einem Paar werden beide Vorsorgesituationen parallel betrachtet. Die nachträgliche Migration
würde Verträge, Vorsorgeanalysen und abgeschlossene Protokolle betreffen.

**Konsequenz:** Der Kundentyp (`PRIVATE`, `COUPLE`, `FAMILY`, `COMPANY`) steuert, wie viele Personen
erwartet werden. Spätere Firmenkunden fügen sich ohne Strukturbruch ein. Die UI muss eine
Schnellanlage mit einer Person unterstützen, damit die Struktur die Erfassung nicht verlangsamt
(siehe Analyse 1.1).

---

## ADR-004 — i18n ab Phase 0, vorerst nur de-CH befüllt
**Datum:** 2026-09-14 · **Status:** entschieden

**Entscheidung:** Ein i18n-Layer (`next-intl` oder gleichwertig) wird ab Phase 0 eingezogen, aber
zunächst nur `de-CH` befüllt. Katalogtexte in der Datenbank (Spartennamen, Kategorien) werden als
`jsonb {de, fr, it}` gespeichert. Der Kunde erhält ein Feld `correspondence_language`.

**Begründung:** Ohne Französisch ist die Westschweiz nicht adressierbar. Nachrüsten betrifft nicht
nur UI-Strings, sondern auch Katalogtexte, PDF-Vorlagen und E-Mail-Texte.

**Konsequenz:** PDF und E-Mail werden in der Sprache **des Kunden** erzeugt, nicht in der des
Beraters. Keine hartcodierten deutschen Strings in Komponenten — auch nicht "vorläufig".

---

## ADR-005 — Datenhaltung Schweiz, Compute Frankfurt
**Datum:** 2026-09-14 · **Status:** entschieden · **Schliesst:** offener Punkt O-2

**Recherche:** Supabase Cloud bietet die Region `eu-central-2` (Zürich); sie wurde gemeinsam mit
Paris, Stockholm und Ohio ausgerollt und unterstützt Datenbank und Read Replicas. Vercel hat
**keine** Schweizer Compute-Region — in Europa stehen `fra1` (Frankfurt), `cdg1`, `arn1`, `dub1`
und `lhr1` zur Verfügung.

**Entscheidung:**
- Supabase-Projekt in `eu-central-2` (Zürich): Datenbank, Auth und Storage.
- Vercel-Functions auf `fra1` (Frankfurt) gepinnt.
- Kundenaussage: *Daten ruhen in der Schweiz, Verarbeitung in der EU.* Nicht: „Schweizer Hosting"
  ohne Zusatz.

**Begründung:** Die Datenhaltung — und damit alles Personenbezogene im Ruhezustand — liegt in der
Schweiz. Eigener Betrieb des Anwendungs-Compute bei einem Schweizer Anbieter (Exoscale,
Infomaniak, cloudscale.ch) würde das vervollständigen, kostet aber geschätzt ein bis zwei Wochen
Einrichtung plus dauerhaften Betriebsaufwand. Gemessen am Leitsatz „kann eine Person das in fünf
Jahren warten" (Analyse 1.8) ist das jetzt der falsche Preis. Die Latenz Zürich–Frankfurt liegt bei
wenigen Millisekunden und ist kein Gegenargument.

**Wichtige Abgrenzung für den Vertrieb:** Datenresidenz ist nicht Unternehmenssitz. Supabase Inc.
und Vercel Inc. bleiben US-Gesellschaften. Unter revDSG mit Auftragsbearbeitungsvertrag handhabbar,
aber offenzulegen — diese Unterscheidung gehört in die Datenschutzerklärung und in jede
Vertriebsaussage.

**Konsequenz:**
- `vercel.json` pinnt `"regions": ["fra1"]`; kein Edge-Runtime für Routen mit Personendaten.
- Die Entkopplung aus Architektur 2.5 bleibt verbindlich, damit ein späterer Umzug des Compute in
  die Schweiz ein Deployment-Thema bleibt und kein Umbau.
- Zu prüfen beim Anlegen des Projekts: ob `eu-central-2` im gewählten Supabase-Tarif verfügbar ist.
- Migration des Compute in die Schweiz wird als Option dokumentiert, nicht eingeplant — Auslöser
  wäre ein Pilotkunde, der es verlangt.


## Noch offen

| # | Offene Entscheidung | Wann nötig |
|---|---|---|
| O-1 | Preismodell: reine Seat-Preise oder Tiers mit Nutzerlimiten | vor Phase 3 (Billing), nicht blockierend fürs MVP |
| O-3 | Juristische Prüfung der Compliance-Aussagen (revDSG, VAG, FIDLEG) vor Marketingaussagen | vor erstem zahlendem Kunden |
| O-4 | AVV-Vorlage, Subprozessorenliste, Datenschutzerklärung, AGB, Exit-Konzept | vor erstem zahlendem Kunden |
