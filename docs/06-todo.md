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

### A1 · Die vier neuen Migrationen einspielen  ⚠️ blockiert alles Neue

Produktiv laufen die Migrationen 0001 bis 0017. Alles aus Phase 5 bis 7 — Aufgaben, Abschluss,
Snapshot, Unterschrift — braucht 0018 bis 0021. **Ohne diesen Schritt siehst du die neuen Seiten,
aber jede Aktion darauf scheitert.**

- [ ] Supabase → **SQL Editor** → neue Abfrage
- [ ] Inhalt von `supabase/bundles/0018-0021.sql` einfügen und ausführen
- [ ] Es muss ohne Fehler durchlaufen; die Datei prüft sich am Ende selbst

Was dabei passiert:

| Migration | Inhalt |
|---|---|
| 0018 | Alle elf Sparten werden Pflicht (neue Vorlagenversion je Firma) |
| 0019 | Tabelle `tasks` für Aufgaben von Kunde und Berater |
| 0020 | Snapshot, Unterschriftentabelle, Schreibschutz für abgeschlossene Beratungen |
| 0021 | Privater Speicherort für Unterschriften samt Zugriffsregeln |

Ich habe das Bundle gegen eine Datenbank im Stand 0017 durchgespielt — es läuft sauber durch.

### A2 · Access-Token-Hook prüfen

Du hast ihn aktiviert. Falls du dich anmeldest und **keine Daten** siehst, ist er es trotzdem:

- [ ] Supabase → **Authentication → Hooks → Customize Access Token (JWT) Claims**
- [ ] Funktion `public.custom_access_token_hook` muss ausgewählt **und aktiv** sein
- [ ] Danach einmal ab- und wieder anmelden, damit ein neues Token ausgestellt wird

### A3 · Der erste vollständige Durchlauf

Das ist der Test, auf den es ankommt — bitte **auf dem iPad**, nicht nur am Notebook:

- [ ] Firma einrichten, Kunden anlegen (Vor- und Nachname genügen)
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

### C2 · Verzeichnis der Bearbeitungstätigkeiten
- [ ] revDSG Art. 12 — ich liefere dir die technische Grundlage dazu, die fachliche Beschreibung
      musst du beisteuern

### C3 · Unterauftragnehmer benennen
Für die Datenschutzerklärung: Supabase (Datenbank, Zürich), Vercel (Anwendung, Frankfurt).
- [ ] Beide in der Datenschutzerklärung aufführen

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
