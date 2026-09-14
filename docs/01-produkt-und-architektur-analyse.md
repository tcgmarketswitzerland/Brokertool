# Schritt 1 — Kritische Produkt- und Architekturanalyse

Status: Entscheidungsgrundlage, vor Architektur (Schritt 2) und Datenmodell (Schritt 4).
Datum: 2026-09-14

---

## 0. Zusammenfassung in einem Absatz

Das Konzept ist inhaltlich stark und trifft ein reales Problem. Die grössten Risiken liegen
**nicht** in der Technologie, sondern in vier Punkten: (1) das Produkt konkurriert faktisch mit
der Doppelerfassung im bestehenden Maklersystem, (2) der eigentliche Kaufgrund ist
Haftungs-/Compliance-Absicherung und nicht Effizienz — das Konzept adressiert das nur indirekt,
(3) der MVP-Umfang ist für eine Person zu breit und enthält mit Vorsorgerechner und
Offertvergleich zwei eigenständige Produkte, (4) mehrere Modellentscheidungen (Haushalt statt
Einzelperson, Unfall/Krankheit-Trennung, Mehrsprachigkeit, Snapshot) sind nachträglich sehr teuer
und müssen jetzt getroffen werden. Der vorgeschlagene Stack ist richtig gewählt; die Risiken darin
sind konkret benennbar und beherrschbar.

---

## 1. Produkt-Risiken

### 1.1 Der Doppelerfassungs-Killer (höchstes Risiko)

Punkt 37 sagt "kein weiteres CRM", Punkt 16 verlangt aber eine vollwertige Kundenverwaltung mit
~15 Feldern inkl. Einkommen, Arbeitgeber, Familienstand, Kinder.

Realität beim Zielkunden: Der Broker hat bereits ein Maklerverwaltungsprogramm oder CRM
(Sobrado, BrokerStar, iBrox, Bexio, oft auch Excel/Outlook). Wenn er vor jedem Gespräch den Kunden
ein zweites Mal erfassen muss, wird das Tool nach der dritten Beratung nicht mehr geöffnet. Das ist
der häufigste Todesursache-Modus für genau diese Produktkategorie.

**Konsequenz für die Planung:**
- Kundenanlage muss in < 30 Sekunden möglich sein: Name, Geburtsdatum, alles andere optional.
- Alle Detailfelder (Einkommen, Beruf, Arbeitgeber) werden **im Gesprächsverlauf** erfasst, dort wo
  sie gebraucht werden (Vorsorge-Sparte fragt nach Einkommen), nicht in einem Stammdatenformular
  vorab.
- CSV-Import von Kundenlisten gehört ins MVP, nicht in Phase 3. Er ist billig zu bauen und entfernt
  die grösste Einstiegshürde.
- Formulierung fürs Produkt: Der Kundendatensatz ist ein *Beratungskontext*, kein Stammdatensatz.

### 1.2 Der eigentliche Kaufgrund ist Haftung, nicht Effizienz

"Ich spare Zeit" verkauft bei einem selbstständigen Broker bei CHF 39/Monat mässig. "Ich kann im
Streitfall beweisen, dass ich den Kunden auf die Vorsorgelücke hingewiesen habe und er abgelehnt
hat" verkauft sehr gut. Genau das ist bereits in Punkt 8 angelegt — aber nicht zu Ende gedacht.

Relevanter Rahmen in der Schweiz (bitte anwaltlich verifizieren lassen, bevor wir damit werben):
- **revDSG** in Kraft seit 1.9.2023 — Bearbeitungsverzeichnis, Informationspflicht, Auftragsbearbeitung.
- **VAG-Revision** in Kraft seit 1.1.2024 — Registrierungspflicht für ungebundene Vermittler,
  Weiterbildungspflicht, Informations- und Offenlegungspflichten gegenüber dem Kunden.
- **FIDLEG** — greift, sobald Anlagecharakter im Spiel ist (fondsgebundene/kapitalbildende
  Lebensversicherungen, Säule-3a-Fondslösungen): Informations-, Eignungs-/Angemessenheitsprüfung
  und Dokumentationspflicht.

**Das wichtigste fehlende MVP-Feature ist damit die Kundenbestätigung.** Eine Dokumentation
"Kunde hat ausdrücklich abgelehnt", die der Berater allein erstellt und beliebig nachträglich
ändern kann, hat im Haftungsfall wenig Wert. Nötig ist:

1. Beratung abschliessen → Zustand wird **eingefroren** (unveränderlich, Hash).
2. Kunde unterschreibt auf dem iPad (Touch-Signatur) oder bestätigt per E-Mail-Link.
3. Das PDF trägt Signatur, Zeitstempel und Dokument-Hash.

Touch-Signatur ist technisch trivial (Canvas → PNG → Storage). Sie ist keine qualifizierte
elektronische Signatur nach ZertES, aber als Beweismittel deutlich besser als nichts. Das ist
meiner Einschätzung nach das stärkste Differenzierungsmerkmal des ganzen Produkts und sollte in
MVP Phase 1 gezogen werden.

### 1.3 PDF gehört ins MVP 1, nicht in Phase 2

Im aktuellen Plan endet MVP Phase 1 mit "Beratungszusammenfassung anzeigen". Damit hat der Berater
nach dem Gespräch nichts in der Hand, was er dem Kunden geben kann. Der gesamte wahrgenommene
Nutzen des Produkts entsteht am Ende des Gesprächs, im Output. Ein MVP ohne Output ist nicht
demonstrierbar und nicht verkaufbar.

**Tausch-Vorschlag:** PDF und Signatur rein in Phase 1; dafür raus aus Phase 1:
- Vollständiges Vertragsmodul (siehe 1.4)
- Offertvergleich (ist ohnehin Phase 2)

### 1.4 Bestehende Verträge sind im MVP überdimensioniert

Punkt 6 verlangt 9 strukturierte Felder plus Dokumenten-Upload pro Vertrag. Das ist während eines
laufenden Kundengesprächs auf einem iPad zu viel Tipparbeit — der Berater hat die Police meist gar
nicht dabei. In der Praxis weiss der Kunde: "Hausrat ist bei der AXA, ca. 480 im Jahr, läuft noch."

**Empfehlung MVP:** Pflichtfelder nur Versicherer + grobe Prämie + Ablauf/Kündigung optional; alle
weiteren Felder optional und eingeklappt. Das volle Vertragsmodul (Deckungen, Selbstbehalte,
Dokumente) kommt in Phase 2, wenn das Backoffice nacherfasst. Das Datenmodell wird trotzdem sofort
vollständig gebaut — nur die UI ist schlank.

### 1.5 Der Vorsorgerechner ist ein Haftungsrisiko, wenn er "einfach" gebaut wird

Das im Konzept skizzierte Modell (Bedarf minus AHV/IV minus PK = Lücke) ist fachlich zu grob und
produziert falsche Zahlen. Der gravierendste Fehler wäre, **Unfall und Krankheit nicht zu trennen**:

- **Erwerbsunfähigkeit durch Unfall:** UVG deckt sehr gut (Taggeld und Invalidenrente in der
  Grössenordnung von 80 % des versicherten Verdienstes, Komplementärrente in Koordination mit der IV).
  Die Lücke ist hier oft klein.
- **Erwerbsunfähigkeit durch Krankheit:** Kein UVG. Krankentaggeld ist freiwillig und beim
  Selbstständigen häufig gar nicht vorhanden. BVG-Invalidenrente setzt erst nach der Wartefrist ein.
  **Hier liegt die eigentliche Lücke.**

Ein Rechner, der beides in einen Topf wirft, zeigt dem Kunden im Unfallfall eine Lücke, die nicht
existiert, und im Krankheitsfall eine, die viel zu klein ist. Beides ist im Beratungsprotokoll
dokumentiert und damit ein Haftungsproblem für unseren Kunden — und für uns.

**Empfehlungen:**
- Szenario-Achse `UNFALL | KRANKHEIT` ab Tag 1 fest im Datenmodell (nicht nachrüstbar ohne Migration
  aller Analysen).
- Keine automatische AHV/IV-Berechnung im MVP. Der Berater trägt Werte aus PK-Ausweis und
  IV-Schätzung manuell ein. Automatische Berechnung (AHV-Skala, BVG-Projektion) ist ein
  eigenständiges Teilprojekt mit jährlichem Pflegeaufwand für Parameter.
- Alle gesetzlichen Parameter (Koordinationsabzug, Umwandlungssatz, BVG-Grenzbeträge, maximale
  AHV-Rente) gehören in eine **versionierte Parametertabelle mit Gültigkeitsjahr**, nie als
  Konstante in den Code. Eine Beratung von 2026 muss 2029 noch mit den Parametern von 2026
  nachvollziehbar sein.
- Sichtbarer Disclaimer im UI und im PDF: Grobanalyse, keine verbindliche Leistungszusage.

### 1.6 Zwei Publikums-Problem im Präsentationsmodus

Berater und Kunde schauen auf denselben Bildschirm. Der Berater braucht aber interne Notizen
("Kunde wirkt unentschlossen", "Konkurrenzofferte prüfen", Provisionsüberlegungen), die der Kunde
nicht sehen darf und die niemals im Kunden-PDF landen dürfen.

**Konsequenz:** Notizen brauchen ab Tag 1 eine Sichtbarkeitsstufe (`INTERNAL` vs. `SHARED`). Das
nachträglich einzuziehen bedeutet, dass Altdaten unklassifiziert sind — und ein interner Kommentar
im Kunden-PDF ist ein Vorfall, der einen Account kostet.

### 1.7 Das Beratungsrad als primäre Navigation ist riskant

Als Präsentations- und Fortschrittselement ist das Rad hervorragend und wahrscheinlich das beste
Verkaufsargument im Demo-Termin. Als primäre Bedienoberfläche hat es Probleme:
- 14 Segmente auf einem iPad ergeben Trefferflächen nahe an der Fat-Finger-Grenze; bei späteren
  Firmenkunden (13 weitere Sparten) wird es unbedienbar.
- Keine Bezeichnungen bei kleinen Segmenten, schlechte Screenreader-Semantik (Accessibility ist in
  Punkt 34 explizit gefordert).
- Kein natürlicher Ort für Statusbadge, Notizindikator, Anzahl offener To-dos.

**Empfehlung:** Rad und Liste als gleichwertige Ansichten desselben Zustands. Das Rad ist die
Übersichts-/Präsentationsansicht und der Fortschrittsanzeiger; die Arbeit passiert in einer
Karten-/Listenansicht mit grossen Touch-Targets. Das Rad muss zudem eine echte `role`-Semantik mit
fokussierbaren Segmenten bekommen, nicht nur SVG-Pfade mit onClick.

### 1.8 Preis- und Marktmodell ist in sich widersprüchlich

Punkt "Geplanter Verkaufspreis: CHF 39 pro Benutzer/Monat" vs. Punkt 31: Professional CHF 79 für
bis zu 3 Benutzer (= CHF 26/User) und Broker CHF 149 für "mehrere". Das sind zwei verschiedene
Modelle. Reine Seat-Preise sind für ein Ein-Personen-Unternehmen deutlich einfacher zu
implementieren und zu erklären als Tiers mit Nutzerlimiten.

Zur Marktgrösse, ehrlich gerechnet: In der Schweiz gibt es in der Grössenordnung einiger tausend
registrierter ungebundener Versicherungsvermittler. Bei realistischen Durchdringungsraten für ein
Ein-Personen-Produkt liegt die erreichbare Grössenordnung im tiefen sechsstelligen ARR-Bereich.
Das ist ein gutes, tragfähiges Geschäft — aber es ist kein Wachstumsfall, der eine teure
Architektur rechtfertigt. **Jede Architekturentscheidung muss sich an der Frage messen: kann eine
Person das in fünf Jahren noch warten?** Das spricht durchgehend für den einfacheren Weg
(Supabase statt eigenes Backend, React-PDF statt Chromium-Worker, keine Microservices,
keine Event-Sourcing-Architektur).

### 1.9 Mehrsprachigkeit ist in der Schweiz kein Nice-to-have

Ohne Französisch ist der Westschweizer Markt nicht adressierbar. i18n nachzurüsten ist teuer,
besonders weil es nicht nur die UI betrifft: Spartennamen, Statusbezeichnungen, PDF-Vorlagen und
E-Mail-Texte müssen mehrsprachig sein, und das PDF muss in der Sprache **des Kunden** erzeugt
werden, nicht in der des Beraters.

**Empfehlung:** i18n-Layer ab Phase 0 einziehen, aber vorerst nur `de-CH` befüllen. Katalogtexte
(Spartennamen etc.) in der DB als `jsonb {de, fr, it}`. Kunde bekommt ein Feld `correspondence_language`.

### 1.10 Löschung vs. Aufbewahrung

revDSG gibt dem Kunden Auskunfts- und Löschungsrechte, während Beratungsdokumentation aus
Nachweisgründen über Jahre aufbewahrt werden muss (Geschäftsbücher-Aufbewahrung in der
Grössenordnung von 10 Jahren, plus Verjährungsfristen für Haftungsansprüche). Diese beiden
Anforderungen stehen im Konflikt.

**Konsequenz:** Kein physisches `DELETE` auf Beratungen und Protokollen. Stattdessen Soft-Delete
plus ein späteres Retention-/Anonymisierungskonzept (Personendaten anonymisieren, Protokollstruktur
erhalten). Das muss im Datenmodell angelegt sein (`deleted_at`, `anonymized_at`), auch wenn die
Funktion erst später gebaut wird.

### 1.11 Vertriebsblocker, die nichts mit Code zu tun haben

Diese fehlen im Konzept und blockieren den ersten zahlenden Kunden zuverlässig:
- Auftragsbearbeitungsvertrag (AVV/ADV) als Vorlage — der Broker ist Verantwortlicher, wir sind
  Auftragsbearbeiter.
- Liste der Unterauftragsbearbeiter (Supabase, Vercel, Storage-Region, später Mailprovider).
- Bearbeitungsverzeichnis, Datenschutzerklärung, AGB, TOM-Beschreibung (technisch-organisatorische
  Massnahmen).
- Backup-/Restore- und Exit-Konzept ("was passiert mit meinen Daten, wenn du aufhörst?"). Diese
  Frage kommt von jedem seriösen Broker.

Das ist kein Entwicklungsaufwand, aber es gehört auf den Projektplan.

---

## 2. Technische Risiken und Architekturprobleme

### 2.1 RLS-Multi-Tenancy: die Standardfalle mit Supabase

Der naive Ansatz lautet, in jeder Policy zu prüfen:
`organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())`.

Drei Probleme:
1. **Performance.** Der Subselect läuft pro Zeile; bei Joins über mehrere Tabellen multipliziert sich
   das. Bei wenigen tausend Zeilen unauffällig, danach spürbar.
2. **Rekursion.** Sobald `organization_members` selbst RLS hat und die Policy auf sich selbst
   verweist, gibt es Endlosrekursion — ein klassischer, schwer zu debuggender Supabase-Fehler.
3. **Konsistenz.** 20 Tabellen mit handgeschriebenen Policies bedeuten 20 Gelegenheiten für einen
   Tippfehler mit Datenleck-Folge.

**Empfohlene Lösung:**
- `organization_id` als Custom Claim ins JWT (Supabase Custom Access Token Hook), plus aktive
  Rolle. Policies prüfen dann gegen den Claim statt gegen eine Tabelle.
- Zusätzlich eine `STABLE SECURITY DEFINER`-Hilfsfunktion als Fallback, mit `search_path` fixiert.
- Policies **generiert**, nicht handgeschrieben: eine Migration mit einer PL/pgSQL-Schleife über
  alle Tenant-Tabellen erzeugt das identische Policy-Set. Neue Tabelle ohne Policy = Build bricht.
- Automatisierter Test, der prüft: jede Tabelle im `public`-Schema hat `ROW LEVEL SECURITY` aktiv
  **und** `FORCE ROW LEVEL SECURITY`. Ohne `FORCE` umgeht der Tabelleneigentümer die Policies.
- Ein Nutzer kann mehreren Organisationen angehören (Broker arbeitet für zwei Firmen) → Konzept
  "aktive Organisation" mit explizitem Wechsel, nicht implizit erster Treffer.

### 2.2 Der `service_role`-Key ist die grösste einzelne Sicherheitsgefahr

Der Service-Role-Key umgeht RLS vollständig. In Next.js ist es verführerisch, ihn serverseitig zu
verwenden, "weil es einfacher ist". Damit ist die gesamte Tenant-Isolation ausgehebelt und hängt
wieder nur am Anwendungscode — genau das, was Punkt 19 ausschliesst.

**Regel für dieses Projekt:** Der Service-Role-Key wird in genau einer Datei gekapselt
(`lib/supabase/admin.ts`), die ausschliesslich von einer Handvoll klar benannter Systemaufgaben
verwendet wird (Onboarding/Org-Erstellung, Webhooks, Wartungsjobs). Ein ESLint-Regel- oder
Grep-basierter CI-Check verbietet den Import ausserhalb dieser Whitelist. Jeder Aufruf über diesen
Client schreibt ins Audit-Log.

### 2.3 Next.js App Router + Caching = potenzielles Cross-Tenant-Leck

Das ist ein reales, unterschätztes Risiko: Der Full Route Cache oder ein unbedachtes
`fetch(..., { cache: 'force-cache' })` kann dazu führen, dass eine gerenderte Seite mit Daten von
Tenant A an Tenant B ausgeliefert wird.

**Regeln:**
- Alles hinter Auth ist strikt dynamisch (`export const dynamic = 'force-dynamic'` bzw. bewusste
  `cookies()`-Nutzung im Segment-Root), nie statisch.
- Keine Tenant-Daten in `unstable_cache` ohne Tenant-Key im Cache-Tag.
- Middleware für Session-Refresh sauber aufsetzen (bekannte Stolperfalle: Cookies müssen sowohl
  auf Request als auch auf Response geschrieben werden).

### 2.4 Offline und Netzverlust im Kundengespräch

Nicht adressiert im Konzept, aber operativ kritisch: Der Berater sitzt beim Kunden zuhause, WLAN
ist fremd oder gar nicht vorhanden, Mobilfunk im Keller schwach. Wenn eine Server-Action mitten im
Gespräch mit einem Fehler abbricht und die letzten 20 Minuten Eingaben verloren sind, ist das
Produkt vor dem Kunden verbrannt — dieser Vorfall passiert genau einmal pro Account.

Gleichzeitig sagt Punkt 22 "keine sensiblen Daten im Client LocalStorage". Das ist ein echter
Zielkonflikt, der aufgelöst werden muss.

**Empfohlener Mittelweg für das MVP (nicht volle Offline-Fähigkeit):**
- Jede Änderung im Beratungsmodus geht in eine lokale Outbox (IndexedDB) und wird von dort
  asynchron synchronisiert, mit Retry und sichtbarem Sync-Status im UI.
- Die Outbox enthält nur die laufende Beratungssession, nicht die Kundendatenbank; sie wird nach
  erfolgreicher Synchronisation und beim Logout gelöscht.
- Alle Schreibvorgänge idempotent (client-generierte UUIDs, Upsert), damit Retry nicht dupliziert.
- Kein `localStorage` für Nutzdaten, Supabase-Session im Cookie (httpOnly serverseitig).

Diese Entscheidung ist architekturprägend: Sie verlangt, dass Beratungsmutationen über eine
klar definierte, serialisierbare Mutations-Schnittstelle laufen und nicht als verstreute
Server-Action-Aufrufe in Komponenten. Nachträglich einzuziehen ist das sehr teuer. **Das ist der
wichtigste Punkt, den ich im Konzept ergänzen würde.**

### 2.5 Datenhaltung in der Schweiz / EU

Anforderung Punkt 22. Zu prüfen und explizit zu dokumentieren:
- Supabase Cloud bietet mehrere europäische Regionen; ob eine Schweizer Region verfügbar ist, muss
  vor Projektstart verifiziert werden (nicht raten — das ist eine Zusage gegenüber Kunden).
- Vercel ist ein US-Unternehmen; Function-Region lässt sich auf Frankfurt pinnen, die
  Vertragspartei bleibt aber US. Für revDSG mit AVV und geeigneten Garantien handhabbar, aber es
  wird im Vertrieb gefragt.
- **Architektonische Absicherung:** Kein tiefes Vendor-Lock-in. Konkret heisst das, Datenzugriff
  läuft über eine dünne Repository-/Service-Schicht, `supabase-js` erscheint nicht in
  React-Komponenten, und Supabase-spezifische Features (Realtime, Edge Functions) werden sparsam
  und gekapselt eingesetzt. Dann ist ein späterer Umzug auf Self-Hosting bei einem CH-Anbieter
  (Exoscale, Infomaniak) ein Projekt von Wochen, nicht von Monaten.

### 2.6 PDF-Erzeugung wird der grösste unterschätzte Zeitfresser

Puppeteer/Headless-Chromium auf Vercel Serverless ist fragil: Binary-Grösse, Cold Starts,
Speicherlimits, Versionsdrift. Das kostet erfahrungsgemäss mehr Zeit als das gesamte
Beratungsformular.

**Empfehlung:** `@react-pdf/renderer` in der Node-Runtime. Deterministisch, keine Browser-Binary,
Schriftarten einbettbar, gut testbar, Layout in React-Syntax. Nachteil ist eingeschränktes CSS —
für ein Beratungsprotokoll völlig ausreichend. Alternative bei sehr hohen Layoutansprüchen später:
Gotenberg in einem eigenen Container, bewusst als separater Dienst.

Ergänzend: Das erzeugte PDF wird gespeichert (nicht bei jedem Abruf neu gerendert), mit Hash. Sonst
ändert sich das "unveränderliche" Protokoll bei jedem Template-Update — ein direkter Widerspruch zu
Punkt 29.

### 2.7 Snapshot/Versionierung — richtig erkannt, aber es gibt eine Falle

Punkt 29 ist die anspruchsvollste Anforderung im ganzen Konzept. Die naheliegende Lösung
(Historientabellen oder bi-temporale Modellierung für alle Entitäten) ist für ein Ein-Personen-
Projekt zu schwer und macht jede spätere Änderung mühsam.

**Empfohlener Ansatz — Hybrid:**
- **Während der Beratung:** normal normalisierte, veränderliche Daten mit Fremdschlüsseln.
- **Beim Abschluss:** Die Beratung wird eingefroren. Ein `advice_session_snapshots`-Datensatz
  speichert den kompletten fachlichen Zustand als validiertes JSONB-Dokument (mit
  Schemaversion), plus SHA-256-Hash, plus die Referenz auf das erzeugte PDF und die Signatur.
- Ab diesem Moment ist die Beratung schreibgeschützt (DB-Trigger, nicht nur Anwendungslogik).
  Korrekturen erzeugen eine neue Version mit Bezug auf die Vorgängerversion — nie eine stille
  Änderung.
- Die Live-Tabellen dürfen sich danach beliebig weiterentwickeln (Police geändert, Kunde
  umgezogen); das Protokoll bleibt korrekt, weil es nicht mehr auf sie zugreift.

Das erfüllt die Anforderung vollständig, kostet aber nur eine Tabelle und einen Trigger statt einer
Versionierungsinfrastruktur.

### 2.8 Konfigurierbarkeit: wo sie aufhören muss

Punkt 27 (Sparten nicht hardcoded) und Punkt 7 (eigene Vergleichsparameter) sind richtig. Die Falle
ist, daraus einen generischen Formular-/No-Code-Builder zu bauen. Das ist ein eigenes Produkt und
frisst Monate, ohne dass ein Kunde dafür zahlt.

**Empfohlene Grenzziehung:**

| Ebene | Konfigurierbar? | Wie |
|---|---|---|
| Welche Sparten existieren | Ja, global | Katalogtabelle `insurance_topics`, per Migration/Seed gepflegt |
| Welche Sparten eine Firma nutzt, Reihenfolge, eigener Name | Ja, pro Organisation | Overlay-Tabelle `organization_topic_settings` |
| Welche Felder eine Sparte hat | Nein zur Laufzeit | Versioniertes JSON-Schema im Code (Zod), pro Sparte, mit Schemaversion |
| Vergleichsparameter im Offertvergleich | Ja, frei | Einfach: Zeilen mit Label/Typ/Einheit pro Vergleich |
| Statusmodell | Nein | Postgres-Enum, fachlich fixiert |

Damit ist die geforderte Flexibilität abgedeckt, ohne eine Metadaten-Engine zu bauen.

### 2.9 Das Datenmodell im Konzept hat sechs konkrete Schwächen

Der Entwurf in Punkt 26 ist eine gute Grundlage. Folgende Punkte würde ich vor der Umsetzung ändern:

1. **`advice_topics` + `advice_topic_results` ist eine Tabelle zu viel.** Sauberer ist die
   Dreiteilung: `insurance_topics` (globaler Katalog), `organization_topic_settings` (Overlay je
   Firma), `advice_session_topics` (die konkrete Instanz je Beratung mit Status, Entscheid,
   Notizen). Ein Ergebnis ohne Topic gibt es nicht.

2. **Haushalt fehlt — und das ist die teuerste Auslassung.** Punkt 16 nennt Paar und Familie als
   Kundentyp, aber das Modell kennt nur `customers`. Realität: Hausrat und Privathaftpflicht gehören
   dem Haushalt, Säule 3a und Erwerbsunfähigkeit gehören einer einzelnen Person, und im Gespräch mit
   einem Paar werden beide Vorsorgesituationen parallel betrachtet.
   **Empfehlung:** `customers` als Klammer (der Mandant / Haushalt / die Firma) und
   `customer_persons` für die natürlichen Personen darunter. Verträge und Vorsorgeanalysen
   referenzieren optional eine Person. `customer_household_members` aus dem Entwurf geht in diese
   Richtung, muss aber zur vollwertigen Person aufgewertet werden, nicht zu einem Anhängsel.
   Nachträglich ist das eine Migration quer durch das ganze Modell.

3. **`notes` als polymorphe Tabelle.** `entity_type` + `entity_id` ohne Fremdschlüssel bedeutet:
   keine referenzielle Integrität, verwaiste Datensätze. Besser: wenige nullable Fremdschlüssel
   (`advice_session_id`, `advice_session_topic_id`, `customer_id`) mit einem CHECK-Constraint, dass
   genau einer gesetzt ist. Plus das oben erwähnte Feld `visibility`.

4. **`documents` und `policy_documents` sind redundant.** Eine `documents`-Tabelle mit optionalen
   Bezügen reicht und vermeidet, dass Zugriffsregeln an zwei Stellen gepflegt werden müssen.

5. **Fehlende Tabellen:** `invitations` (Nutzer einladen), `consents` (DSG-Einwilligung des
   Kunden), `advice_session_participants` (wer sass beim Gespräch am Tisch — protokollrelevant),
   `signatures`, `legal_parameters` (versionierte Vorsorgeparameter nach Jahr).
   Platzhalter für später, aber im Schema vorgesehen: `subscriptions`.

6. **Statusmodell (Punkt 28) vermischt zwei Dimensionen.** `NOT_STARTED / IN_PROGRESS / REVIEWED /
   COMPLETED` beschreibt den *Bearbeitungsfortschritt*; `ACTION_REQUIRED / NO_ACTION_REQUIRED /
   CLIENT_DECLINED / FOLLOW_UP` beschreibt das *fachliche Ergebnis*. In einem Enum führt das zu
   unmöglichen Zuständen und zu Diskussionen wie "ist REVIEWED auch COMPLETED?".
   **Empfehlung: zwei Felder.** `progress_status` (NOT_STARTED, IN_PROGRESS, DISCUSSED, SKIPPED) und
   `outcome` (nullable: NO_ACTION_NEEDED, ACTION_REQUIRED, CLIENT_DECLINED, FOLLOW_UP, OFFER_REQUESTED,
   CONTRACT_REQUESTED). Constraint: Eine Beratung ist abschliessbar, wenn jedes aktive Topic entweder
   ein `outcome` hat oder explizit `SKIPPED` ist. Das macht die Regel "kein Bereich wird vergessen"
   erstmals maschinell prüfbar — was der eigentliche Produktkern ist.

### 2.10 Das zentrale Architekturkonzept, das im Entwurf fehlt: die Beratungsvorlage

Drei Anforderungen hängen zusammen und lassen sich mit einem Konzept gemeinsam lösen:
Konfigurierbarkeit (27), Snapshot-Nachvollziehbarkeit (29) und spätere Firmenkunden (17).

**Vorschlag:** Eine Beratung wird nicht "irgendwie" aus dem Spartenkatalog zusammengesetzt, sondern
aus einer **versionierten Beratungsvorlage** (`advice_templates` / `advice_template_versions`)
instanziiert. Die Vorlage definiert: welche Topics, in welcher Reihenfolge, welche Felder je Topic
(Schemaversion), welche Pflichtfelder für den Abschluss.

Nutzen:
- Firmenkunden sind später schlicht eine andere Vorlage, keine Architekturänderung.
- Eine Beratung von 2026 bleibt nachvollziehbar, weil sie auf eine unveränderliche Vorlagenversion
  zeigt. Ändert die Firma ihre Vorlage, betrifft das nur neue Beratungen.
- Branchenspezialisierung wird später verkaufbar (Vorlage "Vorsorgecheck", "KMU-Check", "Hypothek").
- Die Advice Engine (Punkt 37) bekommt damit ein klares, testbares Domänenmodell statt einer
  Ansammlung von UI-Zuständen.

Das ist meiner Einschätzung nach die wichtigste Ergänzung zum vorgeschlagenen Datenmodell.

### 2.11 Tenant-Isolation lässt sich nicht mocken

Punkt 35 verlangt Tests für Tenant-Isolation. Solche Tests sind wertlos, wenn sie gegen ein Mock
laufen — geprüft wird ja gerade das Verhalten von Postgres-Policies.

**Empfehlung:** Integrationstests gegen eine lokale Supabase-Instanz (Docker), mit zwei echten
Nutzern in zwei Organisationen, die systematisch versuchen, gegenseitig zu lesen und zu schreiben.
Der Test wird **generisch über alle Tabellen** geschrieben, nicht pro Tabelle — dann deckt er
automatisch jede neue Tabelle ab. Das muss in Phase 0 stehen, sonst wird es nie gebaut.

### 2.12 Weitere technische Punkte, kurz

- **Storage:** Keine öffentlichen Buckets. Zugriff ausschliesslich über kurzlebige signierte URLs.
  Pfadschema `{organization_id}/{customer_id}/{uuid}` und RLS-Policy auf `storage.objects`, die den
  ersten Pfadsegment gegen den Tenant prüft. MIME-Whitelist, Grössenlimit, Dateinamen-Sanitizing.
  Virenprüfung ist im MVP nicht realistisch, gehört aber auf die Risikoliste (Broker laden
  fremde Dateien hoch).
- **MFA:** Bei Finanz- und Gesundheitsdaten faktisch erwartet. Supabase Auth kann TOTP; für
  Owner/Admin sollte es früh erzwingbar sein.
- **E-Mail-Versand (Punkt 13):** Ein Beratungsprotokoll als PDF-Anhang unverschlüsselt zu
  versenden, ist bei diesen Daten heikel. Besser: Mail enthält einen zeitlich begrenzten,
  tokenisierten Downloadlink. Das ist auch technisch einfacher als Anhang-Handling.
- **Audit-Log (Punkt 21):** Als Anwendungscode geschrieben, ist es lückenhaft (jeder vergessene
  Pfad fehlt). Besser per Postgres-Trigger auf den relevanten Tabellen — vollständig, kaum Code,
  und der Anwendungscode kann es nicht umgehen. Audit-Einträge dürfen für niemanden ausser Owner
  lesbar und für niemanden änderbar sein (nur INSERT-Policy).
- **Typsicherheit:** Zod-Schemas als einzige Wahrheit für Validierung, DB-Typen via
  `supabase gen types typescript` generiert und im Repo eingecheckt, CI prüft auf Drift.
- **Recharts** ist für die geplanten Diagramme ausreichend und die richtige Wahl. Für das
  Beratungsrad würde ich kein Chart-Library verwenden, sondern handgeschriebenes SVG — ein
  Donut-Chart mit Interaktion, Status-Farbcodierung und Accessibility ist mit Recharts mehr Kampf
  als Nutzen.
- **shadcn/ui** ist gut geeignet (Copy-in statt Dependency), aber die Touch-Targets der Defaults
  sind für iPad-Nutzung im Gespräch teils zu klein. Es braucht früh eine bewusste Anpassung der
  Grössen-Tokens, nicht später punktuelle Overrides.

---

## 3. Was ich jetzt anders planen würde — Zusammenfassung

| # | Änderung | Begründung | Kosten bei späterem Nachrüsten |
|---|---|---|---|
| 1 | Haushalt/Person-Trennung im Kundenmodell | Paar/Familie ist Standardfall, nicht Ausnahme | Sehr hoch (Migration quer durchs Modell) |
| 2 | Szenario Unfall/Krankheit in der Vorsorgeanalyse | Ohne Trennung sind die Zahlen fachlich falsch | Hoch |
| 3 | Statusmodell in Fortschritt + Ergebnis aufteilen | Vermeidet unmögliche Zustände, macht Abschlussregel prüfbar | Mittel |
| 4 | Versionierte Beratungsvorlage einführen | Löst Konfigurierbarkeit, Snapshot und Firmenkunden gemeinsam | Hoch |
| 5 | Notizen mit Sichtbarkeit intern/geteilt | Interne Notiz im Kunden-PDF ist ein Vorfall | Mittel (Altdaten unklassifiziert) |
| 6 | Sync-Outbox für den Beratungsmodus | Netzverlust im Gespräch verbrennt das Produkt | Sehr hoch (verlangt Mutationsschicht) |
| 7 | i18n-Layer ab Phase 0, Katalogtexte mehrsprachig | Westschweiz sonst nicht adressierbar | Hoch |
| 8 | PDF + Kundensignatur in MVP 1 ziehen | Ohne Output kein demonstrierbares Produkt; Signatur ist das Verkaufsargument | — (Reihenfolge) |
| 9 | Vertragsmodul in MVP 1 abspecken | Zu viel Tipparbeit im Gespräch | — (Reihenfolge) |
| 10 | Versionierte gesetzliche Parameter statt Konstanten | Beratung von 2026 muss 2029 nachvollziehbar bleiben | Mittel |
| 11 | CSV-Kundenimport in MVP 1 | Entfernt die grösste Einstiegshürde | Gering |
| 12 | Audit-Log per DB-Trigger statt im Anwendungscode | Lückenlos, nicht umgehbar | Gering |
| 13 | Soft-Delete + Anonymisierungsfelder | Konflikt Löschrecht vs. Aufbewahrungspflicht | Mittel |

---

## 4. Bewertung des vorgeschlagenen Stacks

Der Stack aus Punkt 23 ist für dieses Vorhaben gut gewählt. Meine Bewertung:

**Übernehmen ohne Änderung:** Next.js (App Router), TypeScript strict, React, Tailwind, shadcn/ui,
Supabase (Postgres/Auth/Storage/RLS), Zod, React Hook Form, Recharts, Vercel.

**Ergänzen:**
- `@react-pdf/renderer` für PDF (statt Headless Chromium)
- TanStack Query für Client-State, Sync-Status und die Outbox aus 2.4
- `next-intl` (oder gleichwertig) für i18n ab Phase 0
- Vitest für Unit-Tests, plus Integrationstests gegen lokale Supabase für RLS
- Playwright nur für zwei bis drei kritische End-to-End-Pfade (Login, Beratung durchklicken,
  Abschluss) — nicht mehr
- `dnd-kit` erst wenn tatsächlich Drag-and-Drop gebraucht wird

**Bewusst nicht verwenden:** ORM mit eigenem Migrationsmechanismus parallel zu Supabase-Migrationen
(zwei Wahrheiten für das Schema), tRPC (Server Actions plus Zod reichen und sind weniger
Infrastruktur), State-Management-Bibliothek über TanStack Query hinaus, Monorepo-Tooling, eigene
Backend-Services.

**Einzige echte Alternative, die ich erwägenswert finde:** Statt Supabase Cloud von Anfang an ein
gehostetes Postgres bei einem Schweizer Anbieter plus eigene Auth. Das löst die Datenresidenz-Frage
im Vertrieb sauberer, kostet aber schätzungsweise vier bis sechs Wochen zusätzliche
Entwicklungszeit und dauerhaft Betriebsaufwand. **Empfehlung: nicht jetzt.** Stattdessen die
Entkopplung aus 2.5 konsequent einhalten, damit der Wechsel später möglich bleibt.

---

## 5. Offene Entscheidungen vor Schritt 2

1. Wird die Kundensignatur (Touch-Unterschrift + eingefrorenes PDF) in MVP 1 gezogen?
2. Wird die Sync-Outbox für den Beratungsmodus gebaut, oder reicht ein reines Online-Tool mit
   robustem Autosave?
3. Haushalt/Person-Trennung ab Tag 1 — bestätigt?
4. Welche Sprachen sind Ziel (nur `de-CH`, oder `de-CH` + `fr-CH`)?
5. Preismodell: reine Seat-Preise oder Tiers mit Nutzerlimiten?
6. Ist die Verschiebung (PDF rein in Phase 1, Vertragsmodul abgespeckt) einverstanden?
7. Ist Datenresidenz ein hartes Verkaufsargument, oder reicht "EU, Vertragspartner Schweiz"?
