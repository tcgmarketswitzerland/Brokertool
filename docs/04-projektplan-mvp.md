# Schritt 3 — Projektplan MVP

Grundlage: Analyse (01), Entscheidungen ADR-001 bis ADR-004 (02), Architektur (03).
Datum: 2026-09-14

---

## 0. Vorbemerkung zum Aufwand

Eine ehrliche Einschätzung vorweg, weil der Konzeptentwurf „MVP Phase 1" so beschreibt, als wäre es
ein überschaubarer erster Schritt. Das ist es nicht.

**Geschätzter Gesamtaufwand MVP: 63–91 Personentage.** Bei Vollzeitarbeit entspricht das etwa
**3 bis 4,5 Monaten**. Neben einem Hauptberuf entsprechend deutlich länger. Nicht enthalten sind
Marketing, juristische Vorbereitung (AVV, AGB, Datenschutzerklärung), Vertrieb und Support.

Die Schätzungen sind Spannen, keine Zusagen. Die grösste Unsicherheit liegt in Phase 3
(Advice Engine mit Command-Pipeline) und Phase 7 (PDF) — dort können Einzelprobleme mehrere Tage
kosten.

**Erster demonstrierbarer Meilenstein: Ende Phase 7.** Davor lässt sich das Produkt niemandem
zeigen, weil der Output fehlt. Das ist beim Planen wichtig: Es gibt keine sinnvolle
Zwischendemonstration nach Phase 3.

---

## 1. Arbeitsweise (gilt für alle Phasen)

### 1.1 Definition of Done — für jede Phase identisch

Eine Phase gilt erst als abgeschlossen, wenn **alle** Punkte erfüllt sind:

1. `pnpm typecheck` fehlerfrei (TypeScript strict, keine `any` ohne kommentierte Begründung)
2. `pnpm lint` fehlerfrei, inklusive der Architekturregeln R1–R8
3. `pnpm test` grün — Unit **und** Datenbank-Integrationstests
4. `pnpm build` erfolgreich
5. Die in der Phase genannten fachlichen Abnahmekriterien sind manuell verifiziert
6. Migrationen sind angewendet und die generierten Datenbanktypen aktualisiert
7. Commit mit aussagekräftiger Nachricht, gepusht

### 1.2 Regeln für Migrationen

- Fortlaufend nummeriert, **nie nachträglich geändert**, sobald gepusht.
- Jede Schemaänderung ist eine neue Migration — auch Tippfehler in Spaltennamen.
- Keine manuellen Änderungen an einer produktiven Datenbank (Konzeptpunkt 34).
- Nach jeder Migration: `supabase gen types typescript` und die generierte Datei einchecken.
  Ein CI-Schritt prüft, dass sie nicht veraltet ist.

### 1.3 Branch- und Commit-Strategie

Entwicklung auf `claude/insurance-advisor-saas-uyv9fc`. Ein Commit pro abgeschlossener,
funktionierender Einheit — nicht ein Riesencommit pro Phase. Commit-Nachrichten auf Deutsch oder
Englisch, aber einheitlich.

---

## 2. Phasenübersicht

| Phase | Inhalt | Aufwand | Kumuliert |
|---|---|---|---|
| 0 | Foundation, Toolchain, CI, RLS-Testharness | 5–8 PT | 8 |
| 1 | Authentifizierung, Organisation, Rollen | 6–9 PT | 17 |
| 2 | Kunden (Haushalt und Personen) | 5–7 PT | 24 |
| 3 | Advice Engine — Kern | 15–20 PT | 44 |
| 4 | Verträge und Notizen | 5–7 PT | 51 |
| 5 | Aufgaben | 3–4 PT | 55 |
| 6 | Abschluss, Snapshot, Signatur | 6–8 PT | 63 |
| 7 | Zusammenfassung, PDF, E-Mail-Entwurf | 8–12 PT | 75 |
| 8 | Dashboard und Einstellungen | 4–6 PT | 81 |
| 9 | QA, Seed-Daten, Härtung | 6–10 PT | 91 |

**Abweichung von deiner Nummerierung:** Dein Entwurf hatte Phase 0–7 mit „Summary" als Phase 6 und
„QA" als Phase 7. Ich habe Abschluss/Snapshot (6) von Zusammenfassung/PDF (7) getrennt, weil es zwei
unterschiedlich riskante Arbeiten sind, und Dashboard/Einstellungen als Phase 8 ergänzt — beides ist
in Konzeptpunkt 18 für das MVP verlangt, stand aber in keiner Phase.

### Kritischer Pfad

```
0 → 1 → 2 → 3 → 6 → 7 → 9
             ↘ 4 ↗
             ↘ 5 ↗
                  8 (parallelisierbar)
```

Phasen 4 und 5 hängen an Phase 3, blockieren aber einander nicht. Phase 8 kann jederzeit nach
Phase 5 eingeschoben werden, wenn Abwechslung nötig ist. Die Phasen 3, 6 und 7 sind strikt
sequenziell und bilden das Rückgrat.

---

## Phase 0 — Foundation

**Ziel:** Ein Projektgerüst, in dem die Architekturregeln technisch erzwungen werden. Nach dieser
Phase existiert noch keine Funktionalität, aber jede spätere Fehlentwicklung fällt sofort auf.

**Inhalt**
- Next.js mit TypeScript strict, Tailwind, shadcn/ui initialisieren
- ESLint mit den Regeln R1–R3 und R6 (`no-restricted-imports` für Schichtengrenzen)
- Vitest, Playwright-Grundgerüst
- Supabase lokal (`supabase init`, `supabase start`), erste Migration mit `organizations`
- **RLS-Testharness** — der wichtigste Teil dieser Phase:
  - Vollständigkeitstest: jede Tabelle in `public` hat RLS, FORCE RLS und mindestens eine Policy
  - Isolationstest generisch über alle Tabellen, zwei Nutzer in zwei Organisationen
- Policy-Generator als Migration
- Hilfsfunktionen `auth_org_id()`, `auth_org_role()`, `has_permission()`
- `lib/env.ts` mit Zod-Validierung, getrennte Server- und Client-Schemas
- Logger mit PII-sicherer Signatur (R8)
- i18n-Grundgerüst (`next-intl`), nur `de-CH` befüllt (ADR-004)
- Design-Tokens: Farbpalette, Statusfarben, Dichte-Stufen für `(advisor)`
- GitHub Actions: `typecheck → lint → unit → db-integration → build`
- Ordnerstruktur gemäss Architekturdokument angelegt

**Abnahmekriterien**
- Ein absichtlich eingefügter Import von `supabase-js` in einer Komponente lässt den Lint fehlschlagen
- Eine absichtlich ohne Policy angelegte Testtabelle lässt den Test fehlschlagen
- CI läuft vollständig grün durch

**Risiko:** Gering, aber der Supabase-Custom-Access-Token-Hook lokal zum Laufen zu bringen kann
einen Tag kosten. Lieber hier lösen als in Phase 1 unter Zeitdruck.

**Aufwand: 5–8 PT**

---

## Phase 1 — Authentifizierung, Organisation, Rollen

**Ziel:** Ein Nutzer kann sich registrieren, es entsteht eine Organisation, weitere Nutzer können
eingeladen werden, und die Tenant-Isolation ist nachweislich wirksam.

**Inhalt**
- Migrationen: `profiles`, `organizations`, `organization_members`, `invitations`
- Registrierung: Nutzer + Organisation in einer Transaktion (einziger legitimer
  `service_role`-Einsatz, mit Audit-Eintrag)
- Login, Logout, Passwort zurücksetzen, Magic Link
- Custom Access Token Hook setzt `organization_id`, `organization_role`, `member_id`
- Middleware: Session-Refresh, Schutz von `(app)` und `(advisor)`
- Einladungsflow mit Einmal-Token und Ablauf
- Rollen Owner, Admin, Advisor, Backoffice über `has_permission()`
- Organisationswechsel bei Mehrfachzugehörigkeit
- App-Shell: Navigation, Nutzermenü, leere Platzhalterseiten
- TOTP-MFA aktivierbar (Erzwingung pro Organisation erst in Phase 8)

**Abnahmekriterien**
- Zwei Organisationen anlegen; Nutzer A sieht unter keinen Umständen Daten von Organisation B —
  nachgewiesen durch den Isolationstest, nicht durch Klicken
- Eine Einladung kann nur einmal eingelöst werden und läuft ab
- Ein Backoffice-Nutzer kann keine Organisationseinstellungen ändern

**Risiko:** Mittel. Der Token-Hook und das Cookie-Handling in der Middleware sind die beiden Stellen
mit Erfahrungswert „kostet länger als gedacht".

**Aufwand: 6–9 PT**

---

## Phase 2 — Kunden

**Ziel:** Kunden anlegen, finden und bearbeiten — schnell genug, um im Gespräch zu funktionieren.

**Inhalt**
- Migrationen: `customers`, `customer_persons`, `customer_addresses`, `consents`
- **Schnellanlage:** Vorname, Nachname, Geburtsdatum — mehr ist nicht Pflicht (Analyse 1.1)
- Vollständige Bearbeitung mit allen Feldern aus Konzeptpunkt 16, aber optional und gruppiert
- Kundentyp `PRIVATE | COUPLE | FAMILY | COMPANY`; bei Paar und Familie mehrere Personen (ADR-003)
- Kundenliste mit Suche, Sortierung, Filter (Zustand in der URL)
- Kundendetailseite als Ausgangspunkt für „Neue Beratung"
- **CSV-Import** mit Spaltenzuordnung, Vorschau und Fehlerbericht (Analyse 1.1)
- Feld `correspondence_language` (ADR-004)

**Abnahmekriterien**
- Ein Kunde ist in unter 30 Sekunden angelegt, ohne ein Pflichtfeld zu erfinden
- Ein Paar mit zwei Personen lässt sich korrekt erfassen
- Ein CSV mit 200 Zeilen und drei fehlerhaften Datensätzen importiert 197 und meldet drei
  nachvollziehbar

**Risiko:** Gering. Der CSV-Import ist die einzige Unbekannte; er ist bewusst hier und nicht später,
weil er über Erfolg oder Misserfolg beim ersten Testkunden mitentscheidet.

**Aufwand: 5–7 PT**

---

## Phase 3 — Advice Engine, Kern

**Die grösste und wichtigste Phase.** Hier entsteht das eigentliche Produkt.

**Ziel:** Der Berater startet eine Beratung, arbeitet die Sparten durch, setzt Status und
Entscheidungen — robust gegen Netzverlust.

**Inhalt**

*Datenmodell und Domäne*
- Migrationen: `insurance_topics`, `organization_topic_settings`, `advice_templates`,
  `advice_template_versions`, `advice_sessions`, `advice_session_topics`,
  `advice_session_participants`, `advice_command_log`
- Seed des Spartenkatalogs für Privatkunden (Konzeptpunkt 4), mehrsprachig als `jsonb`
- `domain/advice/status.ts` — zweidimensionales Statusmodell mit erlaubten Übergängen
- `domain/advice/progress.ts` — Fortschrittsberechnung („8 von 14")
- `domain/advice/completion.ts` — `canCompleteSession()`
- Unit-Tests für alle drei, vollständig

*Command-Pipeline (ADR-002)*
- `domain/advice/commands.ts` — reine Handler, im Browser und auf dem Server identisch
- `lib/sync/outbox.ts` — IndexedDB-Persistenz
- `lib/sync/syncEngine.ts` — Batching, Retry mit Backoff, Online/Offline-Erkennung
- Route Handler `/api/advice/sync` mit Idempotenz über `advice_command_log`
- Gerätekonflikt-Erkennung über `active_device_id`

*Oberfläche*
- Route Group `(advisor)` mit navigationsfreiem Layout (Konzeptpunkt 25)
- Beratungsrad als SVG-Komponente, doppelte Statuskodierung, Tastaturbedienung
- Listenansicht als gleichwertige Alternative
- Spartendetail: Status setzen, Ergebnis setzen, Notiz erfassen
- Notizen mit Sichtbarkeit `INTERNAL | SHARED` (Analyse 1.6)
- Sichtbarer Sync-Status in der Kopfzeile
- Navigation Zurück / Rad / Weiter

**Abnahmekriterien**
- Beratung starten, alle 14 Sparten durchgehen, Status und Ergebnisse setzen
- **Netzwerktest:** Im Browser offline schalten, zehn Änderungen vornehmen, wieder online schalten —
  alle Änderungen kommen genau einmal an, ohne Duplikate
- Seite mitten im Gespräch neu laden — der Zustand ist vollständig wiederhergestellt
- Eine interne Notiz ist als solche erkennbar markiert
- `canCompleteSession` meldet korrekt, welche Sparten noch offen sind

**Risiko: Hoch.** Die Command-Pipeline ist der technisch anspruchsvollste Teil des Projekts. Wenn
etwas die Schätzung sprengt, dann hier. Empfehlung: Pipeline zuerst mit **einem** Command-Typ
vollständig durchbauen und testen, bevor die übrigen ergänzt werden.

**Aufwand: 15–20 PT**

---

## Phase 4 — Verträge und Dokumente

**Ziel:** Bestehende Versicherungen je Sparte erfassen — schlank genug fürs Gespräch (ADR-001).

**Inhalt**
- Migrationen: `policies`, `documents`
- Erfassung mit Pflichtfeldern Versicherer und Prämie; alle weiteren Felder aus Konzeptpunkt 6
  optional und eingeklappt
- Versichererliste als Katalog mit Freitextoption
- Storage-Buckets, Pfadschema, RLS auf `storage.objects`
- Dokumenten-Upload über signierte Upload-URL, Download über kurzlebige signierte URL
- Serverseitige Prüfung: MIME-Whitelist, Magic Bytes, Grössenlimit

**Warum der Upload schon hier und nicht später:** Die Storage-Architektur muss ohnehin für die
Signatur (Phase 6) und das Branding (Phase 8) funktionieren. Sie hier zu beweisen, wo ein Fehler
billig ist, ist besser als in Phase 6 unter Druck.

**Abnahmekriterien**
- Ein Vertrag ist mit zwei Feldern erfasst
- Eine als PDF umbenannte ausführbare Datei wird abgelehnt
- Ein Nutzer aus Organisation B kann ein Dokument aus Organisation A auch mit bekannter URL nicht
  laden

**Risiko:** Gering bis mittel. Die Storage-RLS ist erfahrungsgemäss der knifflige Teil.

**Aufwand: 5–7 PT**

---

## Phase 5 — Aufgaben

**Ziel:** To-dos für Kunde und Berater, erfassbar während des Gesprächs.

**Inhalt**
- Migration: `tasks` mit allen Attributen aus Konzeptpunkt 11
- Erfassung direkt aus der Spartenansicht heraus, mit automatischem Bezug zu Beratung und Sparte
- Zuordnung Kunde oder Berater
- Aufgabenliste ausserhalb des Beratungsmodus, mit Filtern
- Status offen / in Bearbeitung / erledigt / storniert

**Abnahmekriterien**
- Eine Aufgabe aus der Spartenansicht trägt automatisch den richtigen Bezug
- Kunden- und Berateraufgaben sind in der Zusammenfassung sauber getrennt abrufbar

**Risiko:** Gering. Diese Phase eignet sich als Erholung nach Phase 3.

**Aufwand: 3–4 PT**

---

## Phase 6 — Abschluss, Snapshot, Signatur

**Ziel:** Die Beratung wird abgeschlossen, eingefroren und vom Kunden bestätigt (ADR-001).

**Inhalt**
- Migrationen: `advice_session_snapshots`, `signatures`
- `domain/advice/summary.ts` — `buildSummary()` erzeugt das `SummaryDocument`
  (Filterung interner Notizen passiert hier)
- Abschlussprüfung im UI: Liste der offenen Sparten mit Sprung zur jeweiligen Stelle
- Postgres-Funktion für den Abschluss: Snapshot schreiben, SHA-256 berechnen, Status setzen
- **Trigger, der abgeschlossene Beratungen und ihre Topics schreibgeschützt macht**
- Signaturerfassung: Canvas auf dem iPad, PNG in den Storage, Referenz im Snapshot
- Korrekturweg: eine abgeschlossene Beratung erzeugt bei Änderung eine neue Version mit Bezug auf
  die Vorgängerversion — nie eine stille Änderung
- Deutlicher Hinweis, dass es sich nicht um eine qualifizierte elektronische Signatur handelt

**Abnahmekriterien**
- Eine Beratung mit offenen Sparten lässt sich nicht abschliessen; die Meldung nennt die Sparten
- Nach dem Abschluss schlägt jeder Änderungsversuch auf Datenbankebene fehl — nicht nur im UI
- Der Snapshot bleibt inhaltlich unverändert, nachdem eine referenzierte Police nachträglich
  geändert wurde (Konzeptpunkt 29)
- Der Hash lässt sich aus dem gespeicherten JSON reproduzieren

**Risiko:** Mittel. Der Schreibschutz-Trigger muss vollständig sein — jede vergessene Tabelle ist
ein Loch in der Nachvollziehbarkeit.

**Aufwand: 6–8 PT**

---

## Phase 7 — Zusammenfassung, PDF, E-Mail-Entwurf

**Ziel:** Der Berater übergibt dem Kunden ein professionelles Protokoll.

**Inhalt**
- Zusammenfassungsansicht auf Basis des `SummaryDocument` (Konzeptpunkt 12)
- PDF mit `@react-pdf/renderer`: Logo, Kunde, Berater, Datum, besprochene Sparten, bestehende
  Verträge, Empfehlungen, Kundenentscheidungen, **abgelehnte Themen**, Aufgaben beider Seiten,
  Signatur, Hash, Disclaimer (Konzeptpunkt 14)
- Schriftarteneinbettung, Seitenumbrüche, Kopf- und Fusszeilen, Seitenzahlen
- PDF wird im Storage abgelegt, nicht bei jedem Abruf neu gerendert
- Erzeugung in der Sprache des Kunden (ADR-004)
- E-Mail-Entwurf: Betreff und Text aus demselben `SummaryDocument`, im Browser bearbeitbar,
  Kopierfunktion und `mailto:` — kein echter Versand (Konzeptpunkt 13)
- JSON- und CSV-Export desselben Dokuments (Konzeptpunkt 15)

**Abnahmekriterien**
- Das PDF einer vollständigen Beratung ist auf zwei Seiten lesbar, korrekt umbrochen und
  präsentabel
- **Eine interne Notiz erscheint unter keinen Umständen im PDF** — mit Test abgesichert
- Ein abgelehntes Thema erscheint mit der Ablehnung im Protokoll
- Zweimaliges Rendern desselben Snapshots ergibt inhaltlich identische Dokumente

**Risiko: Hoch.** PDF-Layout ist erfahrungsgemäss der grösste Zeitfresser im Projekt (Analyse 2.6).
Empfehlung: mit einem bewusst schlichten, typografisch sauberen Layout starten. Ein schlichtes,
fehlerfreies PDF wirkt professioneller als ein aufwendiges mit Umbruchfehlern.

**Aufwand: 8–12 PT**

---

## Phase 8 — Dashboard und Einstellungen

**Ziel:** Der Berater hat einen Einstiegspunkt, die Organisation ist konfigurierbar
(Konzeptpunkte 18 und 20).

**Inhalt**
- Dashboard: offene Beratungen, offene Aufgaben, bald kündbare Policen
- Beratungsübersicht: laufend und abgeschlossen
- Vertragsübersicht über alle Kunden
- Einstellungen: Organisationsdaten, Benutzerverwaltung, Rollen, MFA-Pflicht
- Branding: Logo-Upload für das PDF
- Spartenauswahl je Organisation (`organization_topic_settings`, Konzeptpunkt 27)

**Warum erst hier:** Das Dashboard aggregiert Daten, die vor Phase 5 gar nicht existieren. Früher
gebaut, müsste es zweimal geschrieben werden.

**Abnahmekriterien**
- Die Kennzahlen stimmen mit den Listen überein
- Eine deaktivierte Sparte erscheint in neuen Beratungen nicht mehr, in bestehenden unverändert

**Risiko:** Gering.

**Aufwand: 4–6 PT**

---

## Phase 9 — QA, Seed-Daten, Härtung

**Ziel:** Vorführbar und bei einem Pilotkunden einsetzbar.

**Inhalt**
- Seed-Daten (Konzeptpunkt 36): Demo Broker AG, Berater Peter Muster, Kunde Max Muster mit Familie,
  eine laufende und eine abgeschlossene Beratung mit gemischten Statuswerten
- Playwright-E2E: Login → Kunde → Beratung → Abschluss → PDF
- **Vollständiger Durchlauf auf einem echten iPad**, nicht im Browser-Emulator
- Accessibility-Durchgang: Tastaturbedienung, Kontraste, Beschriftungen (Konzeptpunkt 34)
- Lasttest im Kleinen: Kundenliste mit 2'000 Datensätzen, Policy-Performance prüfen
- Fehlerbehandlung: Netzverlust, abgelaufene Session, gleichzeitige Bearbeitung
- Audit-Trigger auf allen relevanten Tabellen prüfen
- **Restore-Test:** einmal eine Sicherung tatsächlich wiederherstellen und protokollieren
- Sicherheitsdurchgang: Secrets, Header, Rate Limiting auf Auth-Endpunkten

**Abnahmekriterien**
- Eine vollständige Beratung auf dem iPad in unter 45 Minuten, ohne Aussetzer
- Der Isolationstest deckt alle Tabellen ab und ist grün
- Der Restore-Test ist dokumentiert

**Risiko:** Mittel. Der iPad-Test fördert erfahrungsgemäss Bedienprobleme zutage, die am Desktop
unsichtbar waren. Dafür ist Puffer eingeplant.

**Aufwand: 6–10 PT**

---

## 3. Ausdrücklich nicht im MVP

Damit während der Umsetzung keine Diskussion entsteht:

| Funktion | Phase | Begründung |
|---|---|---|
| Vorsorgeanalyse | nach MVP | Eigenständiger Umfang; fachlich anspruchsvoll (Analyse 1.5). Datenmodell und Szenario-Trennung werden aber schon in Phase 3 angelegt |
| Offertvergleich | nach MVP | Eigenständiges Teilprodukt |
| Echter E-Mail-Versand | nach MVP | Adapter vorbereitet |
| Firmenkunden | nach MVP | Vorlagensystem hält es offen |
| Billing und Abonnements | nach MVP | Felder im Schema vorgesehen |
| CRM-Integrationen | nach MVP | JSON/CSV-Export genügt |
| OCR und AI | nach MVP | Konzeptpunkt 32 |
| Volltextsuche über Notizen | nach MVP | |
| Mehrsprachige Oberfläche (fr) | nach MVP | Layer steht ab Phase 0 (ADR-004) |

**Die Vorsorgeanalyse ist die erste Erweiterung nach dem MVP** — sie ist inhaltlich das stärkste
Beratungsargument und rechtfertigt eine eigene, sorgfältige Phase mit eigener fachlicher Prüfung.

---

## 4. Parallel zur Entwicklung zu erledigen

Kein Entwicklungsaufwand, aber ohne diese Punkte gibt es keinen ersten zahlenden Kunden
(Analyse 1.11, offene Punkte O-2 bis O-4):

- [ ] Supabase-Region festlegen und dokumentieren (blockiert Phase 0)
- [ ] Auftragsbearbeitungsvertrag als Vorlage
- [ ] Liste der Unterauftragsbearbeiter
- [ ] Bearbeitungsverzeichnis und TOM-Beschreibung (inklusive der Outbox-Begründung aus ADR-002)
- [ ] Datenschutzerklärung und AGB
- [ ] Juristische Prüfung der Compliance-Aussagen vor jeder Marketingaussage
- [ ] Exit- und Datenrückgabekonzept
- [ ] Zwei bis drei Pilotberater gewinnen, die nach Phase 7 testen

Der letzte Punkt ist der wichtigste: Ein Pilotberater, der ab Phase 7 mit echten Kunden arbeitet,
ist mehr wert als zwei zusätzliche Entwicklungswochen.
