# Deine To-do-Liste

Stand: 2026-09-14, nach Phase 4. Ersetzt die frühere Fassung.

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
| 5 | Aufgaben für Kunde und Berater | offen |
| 6 | Abschluss, Snapshot, Unterschrift | offen |
| 7 | Zusammenfassung, PDF, E-Mail-Entwurf | offen |
| 8 | Firmeneinstellungen, Branding, Spartenauswahl | teilweise |
| 9 | QA, Demo-Daten, Härtung | offen |

**219 Tests grün.** Datenbank, Vercel und alle 17 Migrationen sind produktiv in Zürich.

---

## A — Jetzt: die Anwendung zum Laufen bringen

### A1 · Access-Token-Hook aktivieren  ⚠️ blockiert alles

Die Migration hat den Hook angelegt, aber **nicht aktiviert**. Ohne diesen Schritt kannst du dich
registrieren und anmelden, siehst danach aber **keine Daten** — weil die Mandantenkennung im Token
fehlt und alle Sicherheitsregeln korrekt dichtmachen. Das sieht aus wie ein Fehler, ist aber die
Absicherung bei der Arbeit.

- [ ] Supabase → **Authentication → Hooks → Customize Access Token (JWT) Claims**
- [ ] Funktion `public.custom_access_token_hook` auswählen und aktivieren
- [ ] Einmal ab- und wieder anmelden, damit ein neues Token ausgestellt wird

### A2 · Erster Durchlauf

- [ ] Auf deiner Vercel-URL eine Firma einrichten
- [ ] Einen Kunden anlegen (Vor- und Nachname genügen)
- [ ] Eine Beratung starten und ein paar Sparten durchklicken
- [ ] Einen bestehenden Vertrag erfassen
- [ ] **Auf dem iPad ausprobieren**, nicht nur am Notebook

Wenn dabei etwas klemmt: Screenshot schicken, ich schaue es an.

### A3 · Was du dir ohne Anmeldung anschauen kannst

- `/design` — alle Bausteine in hell und dunkel
- `/design/beratung` — der Beratungsmodus mit Beispieldaten

---

## B — Fachlicher Input, den nur du liefern kannst

Diese Punkte brauche ich für Phase 6 und 7. **Etwa zwei bis drei Wochen Vorlauf**, aber je früher,
desto besser.

### B1 · Pflichtsparten bestätigen
- [ ] Als Pflicht markiert sind derzeit: **Hausrat, Privathaftpflicht, Krankenkasse, Risiko,
      Vorsorge**. Pflicht heisst: Die Beratung lässt sich nicht abschliessen, bevor jede davon ein
      Ergebnis hat oder ausdrücklich übersprungen wurde. Stimmt die Auswahl?

### B2 · Textbausteine
- [ ] **Wie formulierst du eine dokumentierte Ablehnung?** Ein Mustersatz, den das Protokoll
      verwendet. Das ist der Satz, auf den es im Streitfall ankommt
- [ ] Standardtext für die Abschluss-E-Mail an den Kunden
- [ ] Disclaimer für die Vorsorgeanalyse (Grobanalyse, keine verbindliche Leistungszusage)

### B3 · Branding fürs Protokoll
- [ ] Dein Logo als SVG oder PNG mit transparentem Hintergrund, mindestens 600 px breit
- [ ] Eine Hausfarbe als Hex-Wert
- [ ] **Ein Beispiel eines Beratungsprotokolls, wie du es heute erstellst** — als Vorlage für das
      PDF. Das ist der wichtigste Punkt in diesem Abschnitt: ohne ein reales Muster baue ich ein
      Protokoll nach meiner Vorstellung, nicht nach deiner Praxis

---

## C — Vor dem ersten zahlenden Kunden

Kein Entwicklungsaufwand, aber ohne diese Punkte kannst du nicht verkaufen.

### C1 · Juristisch
- [ ] Anwalt oder Datenschutzberater mit Erfahrung in revDSG und Versicherungsvermittlung
- [ ] **Deine Compliance-Aussagen prüfen lassen**, bevor du damit wirbst. Ich habe sie nach bestem
      Wissen eingeordnet, aber es ist dein Verkaufsargument — da darf nichts wackeln
- [ ] Klären: Welche Beweiskraft hat eine Touch-Unterschrift auf dem iPad für die Dokumentation
      einer ausdrücklichen Kundenablehnung?
- [ ] Klären: Welche Aufbewahrungsfrist gilt für Beratungsprotokolle? Davon hängt das Lösch- und
      Anonymisierungskonzept ab

### C2 · Verträge und Unterlagen
- [ ] Auftragsbearbeitungsvertrag als Vorlage — du bist Auftragsbearbeiter, der Broker ist
      Verantwortlicher
- [ ] Liste der Unterauftragsbearbeiter: Supabase (Zürich), Vercel (Frankfurt), später Mailprovider
- [ ] Datenschutzerklärung mit der Formulierung aus ADR-005: *Daten ruhen in der Schweiz,
      Verarbeitung in der EU.* Nicht „Schweizer Hosting" ohne Zusatz
- [ ] AGB
- [ ] Bearbeitungsverzeichnis und TOM-Beschreibung — den technischen Teil liefere ich zu,
      inklusive der Begründung für die lokale Zwischenspeicherung im Beratungsmodus (ADR-002)
- [ ] Exit-Konzept: Was passiert mit den Daten, wenn du aufhörst? Diese Frage stellt dir jeder
      seriöse Broker

### C3 · Laufende Kosten, die du einplanen solltest
- [ ] **Vercel Pro** (ca. USD 20/Monat). Der Hobby-Tarif ist nach Vercels Nutzungsbedingungen nicht
      für kommerzielle Nutzung zugelassen. Zum Entwickeln reicht er, vor dem ersten zahlenden
      Kunden nicht mehr
- [ ] **Supabase Pro** (ca. USD 25/Monat) — der Gratis-Tarif pausiert Projekte bei Inaktivität und
      hat kein tägliches Backup. Für echte Kundendaten nicht vertretbar
- [ ] **Eigener Mailversand** (Resend, Postmark, o. ä., ab ca. USD 15/Monat). Aktuell verschickt
      Supabase die Bestätigungs- und Passwortmails über seinen eingebauten Dienst — mit niedrigem
      Stundenlimit und von einer Supabase-Adresse. Für Tests genügt das, für einen Pilotberater
      nicht

---

## D — Am wichtigsten, und am leichtesten aufzuschieben

### D1 · Pilotberater gewinnen
- [ ] **Zwei bis drei selbstständige Broker**, die ab Phase 7 mit echten Kunden testen
- [ ] Vorab klären: Welches Maklersystem nutzen sie heute? Können sie ihre Kundenliste als CSV
      exportieren? (Der Import ist gebaut und wartet)
- [ ] Fragen, was sie **heute** am meisten nervt — und ob es das ist, was wir bauen

> Ein Pilotberater, der ab Phase 7 mit echten Kunden arbeitet, ist mehr wert als zwei zusätzliche
> Entwicklungswochen. Dieser Punkt entscheidet stärker über den Erfolg als jede technische
> Entscheidung in diesem Projekt — und er ist der einzige, den niemand ausser dir erledigen kann.

### D2 · Preismodell entscheiden
- [ ] Dein Konzept nennt zwei sich widersprechende Modelle: CHF 39 pro Benutzer gegenüber CHF 79
      für bis zu drei Benutzer, also CHF 26 pro Benutzer
- [ ] Empfehlung: reine Preise pro Arbeitsplatz. Einfacher zu erklären und zu implementieren
- [ ] Nicht dringend — wird erst bei Billing nach dem MVP gebraucht

---

## Was ich als Nächstes mache

| Phase | Inhalt | Aufwand |
|---|---|---|
| 5 | Aufgaben für Kunde und Berater, aus dem Gespräch heraus erfasst | 3–4 PT |
| 6 | Beratung abschliessen, Snapshot einfrieren, Kundenunterschrift | 6–8 PT |
| 7 | Zusammenfassung, PDF-Protokoll, E-Mail-Entwurf | 8–12 PT |
| 8 | Firmeneinstellungen, Logo, Spartenauswahl je Firma | 4–6 PT |
| 4b | Dokumenten-Upload (Policen als PDF) | 2–3 PT |
| 9 | QA, Demo-Daten, iPad-Durchlauf, Restore-Test | 6–10 PT |

Nach Phase 7 ist das MVP **demonstrierbar**: Beratung führen, abschliessen, Protokoll übergeben.
Das ist der Moment für die Pilotberater aus D1.

---

## Kurzfassung

Wenn du diese Woche nur drei Dinge machst:

1. **Access-Token-Hook aktivieren** (A1) — fünf Minuten, ohne das läuft nichts
2. **Einmal auf dem iPad durchklicken** (A2) — und mir sagen, was sich falsch anfühlt
3. **Einen Broker anrufen** (D1) — und fragen, was ihn heute am meisten nervt
