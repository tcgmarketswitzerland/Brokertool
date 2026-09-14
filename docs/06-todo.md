# Deine To-do-Liste

Stand: 2026-09-14, nach Abschluss von Phase 0.

Diese Liste enthält **nur, was du selbst machen musst** — Dinge, die ich nicht für dich erledigen
kann, weil sie Konten, Zahlungsmittel, Unterschriften oder fachliche Entscheidungen brauchen.
Was ich entwickle, steht im Projektplan (`04-projektplan-mvp.md`).

Reihenfolge ist bewusst: A blockiert die Entwicklung, B blockiert den ersten Verkauf, C und D
laufen nebenher.

---

## A — Blockiert Phase 1 (Authentifizierung)

Ohne diese drei Punkte kann ich nicht weiterentwickeln. Aufwand insgesamt etwa **1–2 Stunden**.

### A1 · Supabase-Projekt anlegen
- [ ] Konto auf supabase.com, Organisation anlegen
- [ ] Neues Projekt, **Region unbedingt `eu-central-2` (Zürich)** — ADR-005. Die Region lässt sich
      später **nicht** ändern, ein Wechsel bedeutet Migration in ein neues Projekt
- [ ] Datenbankpasswort erzeugen und in einem Passwortmanager ablegen
- [ ] Falls Zürich im gewählten Tarif nicht auswählbar ist: **nicht ausweichen**, sondern mir
      Bescheid geben — dann besprechen wir Frankfurt oder einen Tarifwechsel
- [ ] Aus *Project Settings → API Keys* notieren: Project URL, **Publishable Key**
      (`sb_publishable_…`) und einen **Secret Key** (`sb_secret_…`)
- [ ] Die alten `anon`- und `service_role`-Keys **nicht** verwenden — Supabase schaltet sie bis
      Ende 2026 ab

> Der Secret Key umgeht sämtliche Sicherheitsregeln der Datenbank. Er gehört in den
> Passwortmanager und niemals in eine Chatnachricht, ein Ticket oder das Repository.

### A2 · Vercel-Projekt verbinden
- [ ] Konto auf vercel.com, Repository `tcgmarketswitzerland/Brokertool` importieren
- [ ] Region ist bereits über `vercel.json` auf `fra1` festgelegt — nichts einzustellen
- [ ] Environment Variables setzen (Production **und** Preview):
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- [ ] Beim `SUPABASE_SECRET_KEY` das Schloss-Symbol aktivieren (Sensitive)
- [ ] **Nicht** die Supabase-Integration unter *Optional Integrations* verwenden — sie legt ein
      neues Supabase-Projekt an, bei dem die Region nicht sicher auf Zürich gesetzt werden kann
- [ ] Tarif beachten: Der Hobby-Tarif ist nach Vercels Nutzungsbedingungen nicht für kommerzielle
      Nutzung zugelassen. Zum Entwickeln genügt er; vor dem ersten zahlenden Kunden auf Pro
      wechseln (Kostenpunkt prüfen auf vercel.com/pricing)
- [ ] Prüfen, dass der erste Build durchläuft

### A3 · Lokale Entwicklungsumgebung
- [ ] `.env.example` nach `.env.local` kopieren und die Werte aus A1 eintragen
- [ ] `pnpm install` und `pnpm dev` — die Seite muss unter localhost:3000 erscheinen
- [ ] `pnpm verify` einmal ausführen; alles muss grün sein

---

## B — Blockiert den ersten zahlenden Kunden

Kein Entwicklungsaufwand, aber ohne diese Punkte kannst du nicht verkaufen. **Jetzt anfangen**,
nicht nach dem MVP — ein Anwaltstermin hat Vorlaufzeit.

### B1 · Juristische Grundlagen
- [ ] Anwalt oder Datenschutzberater mit Erfahrung in revDSG und Versicherungsvermittlung suchen
- [ ] **Prüfen lassen, bevor du damit wirbst:** deine Aussagen zu revDSG, VAG und FIDLEG.
      Ich habe sie in `01-produkt-und-architektur-analyse.md` nach bestem Wissen eingeordnet,
      aber es ist dein Verkaufsargument — da darf nichts wackeln
- [ ] Klären lassen: Welche Beweiskraft hat eine Touch-Unterschrift auf dem iPad? Reicht sie für
      die Dokumentation einer ausdrücklichen Kundenablehnung?
- [ ] Klären lassen: Welche Aufbewahrungsfrist gilt für Beratungsprotokolle? Davon hängt das
      Lösch- und Anonymisierungskonzept ab (offener Punkt O-3)

### B2 · Vertragsdokumente
- [ ] Auftragsbearbeitungsvertrag (AVV) als Vorlage — du bist Auftragsbearbeiter, der Broker ist
      Verantwortlicher
- [ ] Liste der Unterauftragsbearbeiter: Supabase (Zürich), Vercel (Frankfurt), später Mailprovider
- [ ] Datenschutzerklärung mit der Formulierung aus ADR-005: *Daten ruhen in der Schweiz,
      Verarbeitung in der EU.* Nicht „Schweizer Hosting" ohne Zusatz
- [ ] AGB
- [ ] Bearbeitungsverzeichnis und TOM-Beschreibung — ich liefere dir den technischen Teil zu,
      inklusive der Begründung für die lokale Zwischenspeicherung im Beratungsmodus (ADR-002)
- [ ] Exit-Konzept: Was passiert mit den Daten, wenn du aufhörst? Diese Frage stellt dir jeder
      seriöse Broker

---

## C — Fachlicher Input, den nur du liefern kannst

Diese Punkte brauche ich für Phase 3 (Advice Engine). **Bis dahin sind es etwa 4–6 Wochen** —
aber je früher, desto besser, weil sie den Spartenkatalog bestimmen.

### C1 · Spartenkatalog bestätigen
- [ ] Die 15 Sparten aus deinem Konzept durchgehen: fehlt etwas? Ist etwas überflüssig?
- [ ] Reihenfolge festlegen — in welcher Abfolge führst du ein Gespräch tatsächlich?
- [ ] Für jede Sparte: **Pflicht oder optional?** Das ist das Feld `is_required` und entscheidet,
      was für den Abschluss zwingend ein Ergebnis braucht. Es ist die technische Umsetzung deines
      Versprechens „kein Bereich wird vergessen"
- [ ] Je Sparte zwei bis drei typische Gesprächsfragen, die das Formular stellen soll

### C2 · Textbausteine
- [ ] Wie formulierst du eine dokumentierte Ablehnung? Ein Mustersatz, den das Protokoll verwendet
- [ ] Standardtext für die Abschluss-E-Mail an den Kunden
- [ ] Disclaimer für die Vorsorgeanalyse (Grobanalyse, keine verbindliche Leistungszusage)

### C3 · Branding
- [ ] Dein Logo als SVG oder PNG mit transparentem Hintergrund, mindestens 600 px breit
- [ ] Eine Hausfarbe als Hex-Wert
- [ ] Ein Beispiel eines Beratungsprotokolls, wie du es heute erstellst — als Vorlage für das PDF

---

## D — Am wichtigsten, und am leichtesten aufzuschieben

### D1 · Pilotberater gewinnen
- [ ] **Zwei bis drei selbstständige Broker** finden, die bereit sind, ab Phase 7 mit echten Kunden
      zu testen
- [ ] Mit ihnen vorab klären: Welches Maklersystem nutzen sie heute? Können sie ihre Kundenliste
      als CSV exportieren?
- [ ] Fragen, was sie **heute** am meisten nervt — und ob es das ist, was wir bauen

> Ein Pilotberater, der ab Phase 7 mit echten Kunden arbeitet, ist mehr wert als zwei zusätzliche
> Entwicklungswochen. Dieser Punkt entscheidet stärker über den Erfolg als jede technische
> Entscheidung in diesem Projekt — und er ist der einzige, den niemand ausser dir erledigen kann.

### D2 · Preismodell entscheiden (offener Punkt O-1)
- [ ] Dein Konzept nennt zwei sich widersprechende Modelle: CHF 39 pro Benutzer gegenüber
      CHF 79 für bis zu drei Benutzer, also CHF 26 pro Benutzer
- [ ] Empfehlung: reine Preise pro Arbeitsplatz. Einfacher zu erklären und zu implementieren als
      Stufen mit Nutzerlimiten
- [ ] Nicht dringend — wird erst bei Billing in Phase 3 nach dem MVP gebraucht

---

## Was ich mache, sobald A erledigt ist

| Phase | Inhalt | Aufwand |
|---|---|---|
| 1 | Authentifizierung, Organisation, Rollen, Einladungen | 6–9 PT |
| 2 | Kunden mit Haushalt/Personen, CSV-Import | 5–7 PT |
| 3 | Advice Engine: Rad, Statusmodell, Command-Pipeline | 15–20 PT |
| … | siehe `04-projektplan-mvp.md` | bis 91 PT |

Ohne A1 kann ich Phase 1 nur teilweise vorbereiten: Migrationen, Domänenlogik und Tests gehen,
aber der Custom Access Token Hook und das Cookie-Handling in der Middleware lassen sich nicht
gegen Stubs entwickeln. Genau diese beiden Stellen habe ich im Projektplan als
„kostet länger als gedacht" markiert.

---

## Kurzfassung

Wenn du diese Woche nur drei Dinge machst:

1. **Supabase-Projekt in Zürich anlegen** (A1) — 20 Minuten, blockiert alles andere
2. **Anwaltstermin vereinbaren** (B1) — hat Vorlaufzeit, also jetzt anstossen
3. **Einen Broker anrufen** (D1) — und fragen, was ihn heute am meisten nervt
