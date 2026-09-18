# Deine To-do-Liste

Stand: 2026-09-17, nach Phase 7. Ersetzt die frühere Fassung.

Hier steht **nur, was du selbst machen musst** — Dinge, die ich nicht erledigen kann, weil sie
Konten, Zahlungsmittel, Unterschriften oder fachliche Entscheidungen brauchen. Was ich entwickle,
steht im Projektplan (`04-projektplan-mvp.md`).

---

## Wo wir stehen

| Phase | Inhalt | Stand |
|---|---|---|
| 0 | Foundation, CI, RLS-Testharness | **fertig** |
| 1 | Auth, Organisation, Rollen, Einladungen, Zwei-Faktor | **fertig** |
| 2 | Kunden mit Haushalt/Personen, CSV-Import | **fertig** |
| 3 | Advice Engine: Rad, Liste, Statusmodell, Command-Pipeline | **fertig** |
| 4 | Bestehende Verträge, Vertragsübersicht | **fertig bis auf Dokumenten-Upload** |
| 5 | Aufgaben für Kunde und Berater | **fertig** |
| 6 | Abschluss, Snapshot, Unterschrift | **fertig** |
| 7 | Protokoll als PDF, E-Mail-Entwurf | **fertig** |
| 8 | Firmeneinstellungen, Branding, Spartenauswahl | teilweise |
| 9 | QA, Demo-Daten, Härtung | offen |

**293 Tests grün.** Damit ist der Weg vom Kunden bis zum unterschriebenen Protokoll vollständig:
Beratung führen → abschliessen → Folgeaufgaben bestätigen → unterschreiben → PDF und E-Mail.

---

## A — Jetzt: zwei Schritte, dann kannst du testen

### A0 · Ab jetzt: Migrationen laufen von selbst

Das Kopieren in den SQL Editor hat ausgedient. Einmalig einzurichten, danach nie wieder:
**`docs/09-umgebungen.md`** führt Schritt für Schritt durch.

Kurz: ein zweites Supabase-Projekt für Stage, zwei GitHub-Umgebungen mit je einem Secret
`DATABASE_URL`, bei `production` dich als Freigeber eintragen. Danach migriert Stage beim Push
von selbst, und die Produktion auf Knopfdruck mit Freigabe.

---

### A1 · Die neuen Migrationen einspielen  ⚠️ blockiert alles Neue

Produktiv laufen die Migrationen 0001 bis 0017. Alles aus Phase 5 bis 7 — Aufgaben, Abschluss,
Snapshot, Unterschrift, Vorsorgeanalyse, Dokumente, Firmenangaben, Berateransicht — braucht 0018 bis 0026. **Ohne diesen Schritt
siehst du die neuen Seiten, aber jede Aktion darauf scheitert.**

- [ ] Supabase → **SQL Editor** → neue Abfrage
- [ ] Inhalt von `supabase/bundles/0018-0026.sql` einfügen und ausführen

Die Datei lässt sich **gefahrlos mehrfach ausführen** — jeder Schritt prüft, ob er schon getan
ist. Der abgebrochene Versuch vom ersten Mal ist damit kein Problem.

Was dabei passiert:

| Migration | Inhalt |
|---|---|
| 0018 | Alle elf Sparten werden Pflicht (neue Vorlagenversion je Firma) |
| 0019 | Tabelle `tasks` für Aufgaben von Kunde und Berater |
| 0020 | Snapshot, Unterschrift, Schreibschutz für abgeschlossene Beratungen |
| 0021 | Weiche nach der Anmeldung: erkennt fehlende Firma und veraltetes Token |
| 0022 | Abschluss schon ab einer besprochenen Sparte; der Rest wird als „nicht thematisiert" festgehalten |
| 0023 | Tabelle `pension_analyses` für die Vorsorgeanalyse |
| 0024 | Dokumente hängen an einer Sparte und sind nach dem Abschluss schreibgeschützt |
| 0025 | Adresse, Kontakt, Logo und Hausfarbe der Firma — sie stehen auf jedem Protokoll |
| 0026 | Berateransicht: jeder sieht seine eigenen Kunden, die Firmenleitung sieht alle; FINMA-Nummern |

Geprüft gegen eine Datenbank im Stand 0017, dreimal hintereinander eingespielt — ohne Fehler und
ohne doppelte Vorlagenversionen.

> **Zur früheren Fehlermeldung „must be owner of table objects":** die stammte aus einer
> Migration 0021, die einen Supabase-Speicherbereich für die Unterschriften anlegen wollte. Diese
> Tabellen gehören in Supabase einer anderen Rolle, der SQL Editor darf sie nicht ändern — es
> hätte einen Handgriff im Dashboard gebraucht. Ein manueller Eingriff an der
> Produktionsdatenbank ist aber genau das, was dieses Projekt ausschliesst. Die Unterschrift
> liegt jetzt in einer eigenen Tabelle, mit denselben Sicherheitsregeln wie alles andere.
> 0021 gibt es nicht mehr.

### A2 · Access-Token-Hook prüfen

Du hast ihn aktiviert. Die Anwendung sagt dir jetzt selbst, wenn etwas fehlt: statt einer leeren
Oberfläche landest du auf `/einrichten` mit einer Erklärung. Falls dort steht, der Hook sei nicht
aktiv:

- [ ] Supabase → **Authentication → Hooks → Customize Access Token (JWT) Claims**
- [ ] Funktion `public.custom_access_token_hook` muss ausgewählt **und aktiv** sein
- [ ] Danach auf „Sitzung erneuern" klicken

### A3 · Der erste vollständige Durchlauf

Erst am Laptop, danach dasselbe auf dem iPad — dort zählt vor allem das Unterschriftenfeld:

- [ ] Registrieren. Kommt eine Bestätigungsmail, bestätigen und anmelden — die Anwendung
      fragt dann nach dem Firmennamen
- [ ] Kunden anlegen (Vor- und Nachname genügen)
- [ ] Einen bestehenden Vertrag erfassen — Versicherer und Prämie reichen
- [ ] Beratung starten, durch alle elf Sparten gehen
- [ ] Bei einer Sparte **„Kunde lehnt ab"** wählen — die Anwendung verlangt dann den Hinweis,
      auf den du hingewiesen hast. Genau dieser Satz zählt im Streitfall
- [ ] Eine Sparte bewusst **überspringen** und sehen, was im Protokoll daraus wird
- [ ] Abschliessen: die vorgeschlagenen Folgeaufgaben prüfen, unterschreiben lassen
- [ ] Protokoll als PDF öffnen und den E-Mail-Entwurf kopieren
- [ ] Unter `/aufgaben` nachsehen, ob die Aufgaben stimmen

Wenn dabei etwas klemmt: Screenshot schicken.

### A4 · Ohne Anmeldung anschaubar

- `/design` — alle Bausteine in hell und dunkel
- `/design/beratung` — der Beratungsmodus mit Beispieldaten

---

## B — Fachlicher Input, den nur du liefern kannst

### B1 · Die Textbausteine gegenlesen  ⚠️ am wichtigsten

In `docs/08-textbausteine.md` stehen meine Entwürfe. Sie sind nach bestem fachlichem Verständnis
geschrieben — **aber ich bin kein Anwalt und du bist der Broker.**

- [ ] **Ablehnungstext**: Trägt der Satz so, wie er dort steht? Er ist der Grund, warum jemand
      CHF 39 im Monat zahlt
- [ ] **Beratungsprotokoll**: Fehlt etwas, das in deiner Branche erwartet wird?
- [ ] **Abschluss-E-Mail**: Klingt das nach dir?
- [ ] **Disclaimer Vorsorgeanalyse**: reicht die Formulierung?

Ändern kannst du das jederzeit — es ist an einer Stelle im Code hinterlegt.

### B2 · Ein echtes Protokoll als Muster
- [ ] **Ein Beratungsprotokoll, wie du es heute erstellst.** Das PDF steht; ohne ein reales Muster
      weiss ich aber nicht, ob es deinen Kunden vertraut vorkommt oder fremd

### B3 · Branding
- [ ] Dein Logo als SVG oder PNG mit transparentem Hintergrund, mindestens 600 px breit
- [ ] Deine Hausfarbe als Hex-Wert, falls du nicht beim Petrol bleiben willst
      (`docs/07-designsystem.md` erklärt, warum es dieser Ton geworden ist)

### B4 · Aufbewahrung und Fristen
- [ ] **Wie lange müssen Protokolle aufbewahrt werden?** Zehn Jahre nehme ich an, brauche aber
      deine Bestätigung — davon hängt ab, wann etwas gelöscht werden darf
- [ ] Dürfen abgeschlossene Beratungen überhaupt je gelöscht werden?

---

## C — Rechtliches, vor dem ersten echten Kunden

Nicht vor dem Testen nötig, aber **bevor echte Kundendaten erfasst werden**.

### C1 · Anwalt
- [ ] Textbausteine prüfen lassen, besonders den Ablehnungstext
- [ ] Auftragsverarbeitungsvertrag (revDSG Art. 9) mit dir als Verantwortlichem
- [ ] Allgemeine Geschäftsbedingungen und Datenschutzerklärung
- [ ] **Nimm `docs/10-bearbeitungsverzeichnis.md` mit.** Der technische Teil ist fertig; die
      offenen Punkte sind als solche markiert. Besonders: das System bearbeitet besonders
      schützenswerte Personendaten (Gesundheit, wirtschaftliche Lage) — daraus folgt womöglich
      eine Datenschutz-Folgenabschätzung nach Art. 22

### C2 · Verzeichnis der Bearbeitungstätigkeiten
- [x] Technischer Teil geschrieben: `docs/10-bearbeitungsverzeichnis.md`
- [ ] Rechtsgrundlagen und Aufbewahrungsfristen ergänzen (Anwalt)

### C5 · Aufbewahrungsfrist festlegen  ⚠️ blockiert das Löschkonzept
- [ ] Wie lange müssen Beratungsprotokolle aufbewahrt werden? Solange das offen ist, löscht das
      System gar nichts endgültig — ich baue das erst, wenn die Frist feststeht. Lieber kein
      Löschen als ein falsches

### C3 · Unterauftragnehmer benennen
Für die Datenschutzerklärung: Supabase (Datenbank, Zürich), Vercel (Anwendung, Frankfurt).
- [ ] Beide in der Datenschutzerklärung aufführen

---

## C4 · Einmal im Jahr: Prämiendaten auffrischen

Das BAG genehmigt die Prämien Ende September für das Folgejahr. Dann brauche ich drei Dateien
von dir, und ein Befehl erzeugt daraus alles Nötige:

- [ ] `Praemien_CH.csv` aus `Archiv_Praemien_<Jahr>.zip` (opendata.swiss)
- [ ] `praemienregionen.xlsx` (priminfo.admin.ch)
- [ ] `zugelassene-krankenversicherer-<Jahr>.xlsx` (BAG)

Danach: `node scripts/bag-daten.mjs <ordner>` — der Rest passiert von selbst. Das Protokoll hält
fest, mit welchem Prämienjahr gerechnet wurde.

---

## D — Was ich als Nächstes baue

Dazu brauche ich nichts von dir, es steht hier nur, damit du es weisst:

1. **Firmeneinstellungen** — Logo, Hausfarbe, welche Sparten deine Firma führt (Phase 8)
2. **Dokumenten-Upload** — Policen zum Kunden ablegen (Rest von Phase 4)
3. **Demo-Daten** — ein Knopf, der eine Beispielfirma mit Kunden und Beratungen anlegt,
   damit du Pilotberatern etwas zeigen kannst, ohne echte Daten zu erfassen (Phase 9)
4. **Vorsorgeanalyse** — die Grobanalyse mit der Trennung Unfall/Krankheit aus der Analyse

---

## Was du schon erledigt hast

- Supabase-Projekt in Zürich, Vercel-Projekt in Frankfurt, alle Umgebungsvariablen
- Migrationen 0001 bis 0017 produktiv
- Access-Token-Hook aktiviert
- Entscheidung: alle elf Sparten sind Pflichtsparten
- Pilotberater und laufende Kosten geklärt
