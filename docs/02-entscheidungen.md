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


## ADR-006 — Neue Supabase-API-Schlüssel statt anon/service_role
**Datum:** 2026-09-14 · **Status:** entschieden

**Entscheidung:** Das Projekt verwendet die neuen Supabase-Schlüssel
(`sb_publishable_…` / `sb_secret_…`). Die Umgebungsvariablen heissen entsprechend
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` und `SUPABASE_SECRET_KEY`.

**Begründung:** Supabase schaltet die alten `anon`- und `service_role`-Keys bis Ende 2026 ab. Ein
neues Projekt darauf zu starten, hiesse eine Migration über alle Umgebungen einzuplanen, bevor der
erste Kunde da ist. Die neuen Schlüssel sind funktional gleichwertig und direkt einsetzbar.

**Konsequenz:** Die Variablennamen bilden ab, was tatsächlich darin steht — ein publishable Key in
einer Variablen namens `ANON_KEY` wäre in sechs Monaten eine Fehlerquelle. Regel R3 und der
Baumscan in `scripts/check-service-role.mjs` gelten unverändert für `SUPABASE_SECRET_KEY`.


## ADR-007 — iPad und iPhone als installierbare Web-App, App Store später und nur mit Grund
**Datum:** 2026-09-17 · **Status:** entschieden

**Entscheidung:** Brokertool bleibt eine Webanwendung und wird über das Web-App-Manifest auf iPad
und iPhone installierbar („Zum Home-Bildschirm"). Es gibt vorerst keine App-Store-Fassung. Die
Anwendung wird aber so gebaut, dass ein nativer Rahmen (Capacitor) später dieselbe Anwendung laden
kann, ohne dass etwas umgeschrieben werden muss.

**Begründung:**

Eine installierte Web-App liefert praktisch alles, was im Kundengespräch zählt: eigenes Symbol auf
dem Home-Bildschirm, Start ohne Browserleiste, Vollbild, eigene Statusleistenfarbe. Der Berater
sieht kein Adressfeld — und der Kunde, der mitliest, auch nicht.

Was sie nicht liefert: Push-Benachrichtigungen auf iOS unterhalb der jeweils aktuellen Version,
Kamera- und Dateizugriff in der nativen Tiefe, und Auffindbarkeit im App Store. Keines davon ist
für das MVP nötig.

Gegen eine App-Store-Fassung jetzt spricht mehr als der Aufwand: Apple weist Apps ab, die nur eine
Website in einen Rahmen packen (Richtlinie 4.2, „Minimum Functionality"). Eine Einreichung ohne
nativen Mehrwert kostet Entwicklerkonto, Wartezeit und endet voraussichtlich mit einer Ablehnung.
Der Mehrwert müsste erst existieren — etwa Push für fällige Aufgaben oder das Einlesen einer Police
mit der Kamera.

**Konsequenz:**

- Manifest, Symbole und iOS-Metadaten stehen (`src/app/manifest.ts`, `public/icons/`).
- `viewport-fit=cover` plus `env(safe-area-inset-*)`: ohne die Abstände läge die Bedienleiste des
  Beratungsmodus als installierte App unter dem Home-Indikator.
- Jede Ansicht muss ab 390 px Breite ohne waagrechtes Scrollen funktionieren. Das wird bei jeder
  Oberflächenänderung geprüft, nicht nachträglich repariert.
- **Noch offen:** ein Service Worker. Ohne ihn startet die Anwendung offline nicht — die
  Befehlspipeline puffert zwar Eingaben im Gespräch (ADR-002), aber nur solange die Seite offen
  bleibt. Das ist die nächste Stufe, wenn der Feldtest zeigt, dass es gebraucht wird.
- Der Weg in den App Store bleibt offen: Capacitor lädt dieselbe gehostete Anwendung. Ausgelöst
  wird er durch ein natives Bedürfnis, nicht durch den Wunsch nach einem Symbol im Store.


## ADR-008 — Abschluss ab einer besprochenen Sparte (ersetzt die Pflichtsparten-Regel)
**Datum:** 2026-09-17 · **Status:** entschieden

**Entscheidung:** Eine Beratung ist abschliessbar, sobald **eine** Sparte ein Ergebnis hat. Alle
übrigen werden beim Abschluss ausdrücklich als *„im Gespräch nicht thematisiert"* festgehalten —
in der Datenbank und im Protokoll.

**Begründung:** Die vorherige Regel (jede Sparte braucht ein Ergebnis, ADR zu Migration 0018) kam
aus dem Versprechen „kein Bereich wird vergessen". Der erste echte Test hat gezeigt, dass sie am
Gespräch vorbeigeht: Ein Kunde kommt wegen der Motorfahrzeugversicherung und hat vierzig Minuten.
Eine Sperre, die ihn zwingt, elf Sparten durchzuklicken, führt zu einem von zwei Ergebnissen —
entweder wird durchgeklickt, ohne dass gesprochen wurde (dann ist die Dokumentation eine Lüge),
oder die Beratung wird nie abgeschlossen (dann gibt es gar keine Dokumentation). Beides ist
schlechter als die neue Regel.

**Das Versprechen bleibt, nur anders eingelöst.** Nicht durch eine Sperre, sondern dadurch, dass
zu jeder Sparte ein Satz im Protokoll steht. Eine Lücke muss man später erklären, einen
dokumentierten Satz nicht.

**Konsequenz:**
- `complete_advice_session` setzt unberührte Sparten auf `SKIPPED` (Migration 0022).
- Die Vorschau vor dem Abschluss nennt diese Sparten beim Namen — der Berater sieht, was er
  festhält, und kann zurückspringen.
- `is_required` bleibt im Datenmodell und steuert, was die Oberfläche hervorhebt. Es sperrt nicht
  mehr.
- Die Kennzahl „Pflicht offen" verliert ihre Bedeutung und verschwindet aus der Zusammenfassung.


## ADR-009 — Entscheidungen in der Sprache des Brokers
**Datum:** 2026-09-17 · **Status:** entschieden

**Entscheidung:** Die Ergebnisse einer Sparte heissen: *Offerte unterzeichnen*, *Offerte
bestellen*, *Anpassung gewünscht*, *Kein Handlungsbedarf seitens Broker*, *Kein Handlungsbedarf
seitens Kunden*. `FOLLOW_UP` bleibt im Datenmodell für bestehende Beratungen, wird aber nicht mehr
angeboten.

**Begründung:** Die vorherigen Bezeichnungen waren aus dem Datenmodell heraus benannt
(„Handlungsbedarf", „Kunde lehnt ab"). Die neuen sind die Worte, die im Gespräch fallen.

Die wichtigste Änderung ist die Aufspaltung von „kein Handlungsbedarf": Sagt der **Broker**, dass
nichts zu tun ist, ist das ein fachliches Urteil. Sagt der **Kunde** es gegen den Rat, ist es eine
Entscheidung, die im Streitfall belegen muss, worüber aufgeklärt wurde. Das sind zwei verschiedene
Sachverhalte, und nur der zweite löst die Pflichtbegründung aus.

**Konsequenz:** Enum-Werte bleiben unverändert — ein Enum-Wert weniger hiesse, bestehende
Dokumentation unlesbar zu machen. Geändert haben sich nur die Beschriftungen und die Auswahlliste.


## ADR-010 — Dokumente ohne Storage-Richtlinien
**Datum:** 2026-09-18 · **Status:** entschieden

**Entscheidung:** Kundendokumente liegen in einem privaten Supabase-Bucket. Der Zugriff läuft
nicht über Storage-Richtlinien, sondern über zwei eigene Routen: `POST /api/dokumente` und
`GET /api/dokumente/<id>`. Beide prüfen zuerst über RLS auf den Tabellen `customers` und
`documents`, ob die Zeile überhaupt sichtbar ist, und fassen die Datei erst danach an — mit dem
geheimen Schlüssel, in `src/lib/storage/documents.ts`.

**Begründung:** Storage-Richtlinien setzen Eigentum an `storage.objects` voraus. In einem
Supabase-Projekt gehört diese Tabelle `supabase_storage_admin`; `create policy` scheitert mit
*must be owner of table objects*. Dieselbe Meldung hatte schon die Unterschrift betroffen. Die
Alternative — Richtlinien von Hand im Dashboard klicken — widerspricht der Regel, dass es keine
manuellen Produktionsänderungen an der Datenbank gibt.

Die Mandantentrennung hängt damit nicht am Anwendungscode: sie hängt weiterhin an RLS, nur wird
sie eine Ebene früher abgefragt. Findet die Datenbank das Dokument nicht, gibt es keine signierte
URL — und die Antwort ist dieselbe wie bei einer erfundenen ID.

**Konsequenz:**
- `AdminReason` bekommt den Wert `document:storage`; jeder Aufruf wird protokolliert.
- Signierte URLs leben 60 Sekunden und werden nie gespeichert.
- Der gemeldete Dateityp wird nicht geglaubt: geprüft werden die ersten Bytes
  (`src/domain/document/sniff.ts`). Angenommen werden PDF, JPEG und PNG bis 20 MB.
- Der Dateiname im Bucket ist eine UUID; der Originalname steht nur in der Datenbank und wird
  nie als Pfad verwendet.
- Gelöscht wird weich. Ein Dokument, das an einer abgeschlossenen Beratung hängt, lässt sich gar
  nicht mehr ändern — derselbe Schreibschutz wie für Notizen und Analyse.


## ADR-011 — Datum und Betrag ohne Intl
**Datum:** 2026-09-18 · **Status:** entschieden

**Entscheidung:** Beträge und Daten werden mit eigenen Funktionen formatiert
(`src/domain/shared/money.ts`, `src/domain/shared/date.ts`). `Intl` und `toLocaleDateString`
kommen in gerenderten Ausgaben nicht mehr vor.

**Begründung:** Die Ausgabe von `Intl` hängt von der ICU-Version ab, und die ist im Node-Prozess
eine andere als im Browser. Server und Client formatierten dann unterschiedlich, und React
verwarf die gesamte Seite mit einem Hydration-Mismatch. Genau das ist im Prämienvergleich
passiert: `1'234.50` auf dem Server, `1 234.50` im Browser.

**Konsequenz:** Die Formate sind fest verdrahtet und getestet — Apostroph als Tausendertrennzeichen,
`TT.MM.JJJJ` beim Datum. Eine zweite Sprache braucht später eine Tabelle, kein `Intl`.


## ADR-012 — Sichtbarkeit je Berater, erzeugt statt geschrieben
**Datum:** 2026-09-18 · **Status:** entschieden

**Entscheidung:** Ein Berater sieht seine eigenen Kunden und Beratungen. Die Firmenleitung (Inhaber,
Administrator) und das Backoffice sehen alles, samt zuständigem Berater. Die Regel steht nicht in
20 handgeschriebenen Policies, sondern im Generator `apply_tenant_rls()`: er hängt an jede
Mandantentabelle automatisch die passende Bedingung an — je nachdem, ob sie eine Spalte
`customer_id`, `session_id` oder `policy_id` trägt.

**Begründung:** Bis hierher galt „wer zur Firma gehört, sieht alles, was der Firma gehört". Für ein
Einzelbüro ist das richtig, für ein Maklerbüro mit mehreren Beratern falsch.

Die naheliegende Umsetzung wäre gewesen, `customers` und `advice_sessions` einzuschränken. Das
hätte ein Loch gelassen: Notizen, Verträge, Dokumente, Aufgaben und die Vorsorgeanalyse hängen am
Kunden, tragen seine Daten und wären weiterhin für jeden in der Firma lesbar gewesen. Es sind
heute 14 solche Tabellen, und die nächste kommt bestimmt.

Deshalb kennt der Generator die Regel. `assert_rls_complete()` prüft ab 0026 zusätzlich, dass jede
Mandantentabelle entweder an einem Kunden hängt oder ausdrücklich in `rls_org_wide_tables()` steht.
Wer eine neue Tabelle anlegt und beides vergisst, bekommt einen Fehler in der Migration — nicht ein
Datenleck im Betrieb.

**Konsequenz:**
- `customers.primary_advisor_id` bekommt den Vorgabewert `auth_member_id()`, gelesen aus dem
  JWT-Claim, den der Access-Token-Hook seit 0010 setzt. Wer einen Kunden anlegt, ist für ihn
  zuständig.
- Bestehende Kunden werden dem Mitglied zugeordnet, das sie angelegt hat.
- Backoffice sieht bewusst alles: seine Aufgabe ist das Nachpflegen fremder Fälle.
- Eine Beratung sieht auch, wem der Kunde gehört — sonst bräche die Geschichte des eigenen Kunden
  ab, sobald ein Kollege einmal eingesprungen ist.
- Die Datenbanktests setzen `member_id` jetzt in die JWT-Claims. Ohne diesen Claim sieht ein
  Berater nichts.

## ADR-013 — Die Firma wird an einer Stelle eröffnet
**Datum:** 2026-09-18 · **Status:** entschieden

**Entscheidung:** Eine Brokerfirma entsteht ausschliesslich unter `/einrichten`, mit Name,
Kontakt-E-Mail, Telefon, Adresse und FINMA-Registernummer. Die Registrierung legt nur noch das
Konto an.

**Begründung:** Vorher konnte die Firma an zwei Stellen entstehen — bei der Registrierung, wenn
die E-Mail-Bestätigung ausgeschaltet ist, und unter `/einrichten` sonst. Zwei Stellen heissen zwei
Gelegenheiten, sie unvollständig anzulegen. Die Angaben stehen auf jedem Beratungsprotokoll, und
nachgetragen wird erfahrungsgemäss nie.

**Konsequenz:** Das Feld „Firma" verschwindet aus dem Registrierungsformular. Der Berater wird vom
Adminaccount erfasst — mit Vor- und Nachname, Jobtitel und eigener FINMA-Nummer; diese Angaben
stehen in der Einladung und wandern beim Einlösen in die Mitgliedschaft. Was im Protokoll steht,
hängt damit nicht davon ab, was jemand bei der Anmeldung in ein Namensfeld tippt.


## ADR-014 — Zahlungsmittel ohne Zahlungsdaten
**Datum:** 2026-09-18 · **Status:** entschieden

**Entscheidung:** Brokertool speichert **keine Kartennummer, kein Ablaufdatum mit Prüfziffer und
keinen Sicherheitscode**. Die Tabelle `payment_methods` hält die Wahl des Mittels (Kreditkarte,
PayPal, Apple Pay), die Kennungen des Zahlungsanbieters und einen Anzeigetext — mehr nicht. Ein
Check-Constraint weist zwölf zusammenhängende Ziffern im Anzeigefeld zurück.

**Begründung:** Wer Kartendaten selbst entgegennimmt, fällt unter PCI-DSS. Das ist eine Pflicht,
die eine Beratungssoftware nicht tragen sollte und auch nicht muss: der Zahlungsanbieter nimmt die
Daten entgegen und gibt uns eine Kennung zurück.

Solange kein Anbieter verbunden ist, bleibt der Status auf `PENDING`, und die Ansicht sagt das
auch. Ein Formular, das nach einer Kartennummer fragt und sie irgendwo ablegt, wäre die
schlechtere Alternative — auch als Zwischenlösung.

**Konsequenz:**
- Die Abrechnung führt der Inhaber, nicht der Administrator. Umgesetzt mit einer **restriktiven**
  Policy: sie wird mit UND verknüpft und kann den Satz des Generators daher verschärfen, statt ihn
  zu ersetzen.
- Offen bleibt die Wahl des Anbieters (Stripe, Datatrans, Wallee). Das Datenmodell ist darauf
  vorbereitet: `provider`, `provider_customer_id`, `provider_method_id`.

## ADR-015 — Firmenweite Tabellen als Registratur, nicht als Liste im Code
**Datum:** 2026-09-18 · **Status:** entschieden

**Entscheidung:** Welche Mandantentabellen absichtlich der ganzen Firma gehören, steht in der
Tabelle `rls_org_wide_registry`. `rls_org_wide_tables()` liest sie aus.

**Begründung:** Zuerst stand die Liste im Rumpf der Funktion. Beim Prüfen des Migrationsbündels
fiel auf, dass der zweite Durchlauf scheiterte: 0027 trug `payment_methods` nach, dann lief 0026
erneut und überschrieb die Funktion mit ihrer alten Liste — die Prüfung schlug an, zu Recht. Eine
Liste im Code zwingt jede spätere Migration, sie vollständig zu wiederholen, und macht die
Reihenfolge des erneuten Einspielens plötzlich wichtig.

**Konsequenz:** Eine spätere Migration trägt einen Namen mit einer Zeile nach
(`insert ... on conflict do nothing`). Mehrfaches Einspielen in beliebiger Reihenfolge ändert das
Ergebnis nicht mehr.


## Noch offen

| # | Offene Entscheidung | Wann nötig |
|---|---|---|
| O-1 | Preismodell: reine Seat-Preise oder Tiers mit Nutzerlimiten | vor Phase 3 (Billing), nicht blockierend fürs MVP |
| O-3 | Juristische Prüfung der Compliance-Aussagen (revDSG, VAG, FIDLEG) vor Marketingaussagen | vor erstem zahlendem Kunden |
| O-4 | AVV-Vorlage, Subprozessorenliste, Datenschutzerklärung, AGB, Exit-Konzept | vor erstem zahlendem Kunden |
