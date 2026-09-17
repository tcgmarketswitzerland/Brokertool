# Verzeichnis der Bearbeitungstätigkeiten

Entwurf des technischen Teils · Stand 2026-09-17 · revDSG Art. 12, DSV Art. 1

> **An wen sich das richtet:** Diesen Teil kann nur jemand schreiben, der das System kennt — also
> ich. Was darin **nicht** steht, weil es eine Rechts- und keine Technikfrage ist: Rechtsgrundlage,
> Aufbewahrungsfristen und die Beurteilung, ob eine Datenschutz-Folgenabschätzung nötig ist. Die
> Lücken sind als **„offen"** markiert. Nimm das Dokument so mit zum Anwalt; es spart dir die
> Stunde, in der er sich das System erklären lässt.

---

## 1. Verantwortlicher

| | |
|---|---|
| Verantwortlicher | *offen — deine Firma, Adresse, UID* |
| Kontakt Datenschutz | *offen* |
| Vertreter in der Schweiz | entfällt (Sitz in der Schweiz) |

Brokertool ist **Auftragsbearbeiter**, sobald es andere Broker als Kunden hat. Für deine eigene
Nutzung bist du Verantwortlicher. Beide Rollen brauchen ein eigenes Verzeichnis — dieses beschreibt
das System, aus dem sich beide speisen.

---

## 2. Bearbeitungszwecke

| Zweck | Was dafür bearbeitet wird |
|---|---|
| Beratung von Versicherungskunden dokumentieren | Personendaten, Haushaltsangaben, besprochene Sparten, Entscheidungen |
| Nachweis der Beratung im Haftungsfall | eingefrorenes Protokoll mit Prüfsumme, Unterschrift |
| Folgeaufgaben abwickeln | Aufgaben mit Fälligkeit, Zuständigkeit |
| Bestehende Verträge führen | Versicherer, Prämien, Deckungen, Kündigungsfristen |
| Vorsorgelücken aufzeigen | Einkommen, Haushalt, Renten laut Vorsorgeausweis |
| Zugang und Nachvollziehbarkeit sichern | Anmeldedaten, Audit-Log |

---

## 3. Kategorien betroffener Personen

- **Kunden und deren Haushaltsangehörige** — Partnerinnen und Partner, Kinder
- **Benutzer des Systems** — Berater, Backoffice, Administration der Brokerfirma

---

## 4. Kategorien bearbeiteter Personendaten

| Kategorie | Felder | Tabelle |
|---|---|---|
| Identität | Vor-/Nachname, Geburtsdatum, Geschlecht, Zivilstand | `customer_persons` |
| Kontakt | Telefon, E-Mail | `customer_persons` |
| Adresse | Strasse, PLZ, Ort, Land | `customer_addresses` |
| Erwerb | Beruf, Arbeitgeber, Anstellungsart, **Jahreseinkommen** | `customer_persons` |
| Beratungsinhalt | Sparte, Deckungsstand, Entscheidung, Notizen | `advice_session_topics`, `notes` |
| Verträge | Versicherer, Police, Prämie, Selbstbehalt, Laufzeit | `policies` |
| Vorsorge | Einkommen, Haushalt, Renten je Fall | `pension_analyses` |
| Aufgaben | Titel, Beschreibung, Frist | `tasks` |
| Protokoll | eingefrorenes Dokument, SHA-256-Prüfsumme | `advice_session_snapshots` |
| Unterschrift | Bild, Name, Zeitpunkt, **IP-Adresse**, Browserkennung | `signatures` |
| Dokumente | hochgeladene Dateien zum Kunden | `documents` |
| Zugriffsspuren | wer hat wann welchen Datensatz geändert | `audit_logs` |

### Besonders schützenswerte Personendaten (Art. 5 lit. c revDSG)

**Ja, das System bearbeitet solche Daten.** Das ist der Punkt, den der Anwalt zuerst sehen sollte:

- **Gesundheitsdaten**, sobald in der Sparte Krankenkasse oder Risiko etwas notiert wird, das auf
  den Gesundheitszustand schliessen lässt — eine Notiz wie „Vorerkrankung, Aufnahme abgelehnt"
  genügt.
- **Daten über die Sozialhilfe oder wirtschaftliche Lage**: Jahreseinkommen, Vorsorgelücken.

Daraus folgt technisch das erhöhte Schutzniveau, das unten beschrieben ist. Ob daraus zusätzlich
eine **Datenschutz-Folgenabschätzung** (Art. 22 revDSG) folgt: *offen, juristisch zu klären*.

---

## 5. Empfänger und Bekanntgabe

| Empfänger | Wozu | Wo |
|---|---|---|
| Supabase (Datenbank, Dateien) | Speicherung | **Zürich, Schweiz** |
| Vercel (Anwendung) | Ausführung der Anwendung | **Frankfurt, EU** |
| Versicherer | nur, was der Berater ausserhalb des Systems weitergibt | — |

**Bekanntgabe ins Ausland:** Die Anwendung läuft in Frankfurt; dabei werden Daten in der EU
bearbeitet, aber nicht dauerhaft gespeichert. Die EU verfügt über einen angemessenen Datenschutz
(Anhang 1 DSV). Die Speicherung selbst bleibt in der Schweiz.

*Offen:* Auftragsbearbeitungsverträge mit Supabase und Vercel (beide bieten Standardverträge an).

---

## 6. Aufbewahrung und Löschung

| Datenkategorie | Frist | Stand |
|---|---|---|
| Beratungsprotokolle und Unterschriften | *offen — Annahme 10 Jahre* | technisch unveränderlich, kein automatisches Löschen |
| Kundendaten ohne Beratung | *offen* | löschbar, Soft-Delete vorhanden |
| Audit-Log | *offen* | nicht löschbar, auch nicht durch die Administration |
| Unterschriften-IP | *offen* | wird im Klartext gespeichert, Zweck ist der Nachweis |

**Technischer Stand:** Löschen ist als Soft-Delete umgesetzt (`deleted_at`); ein endgültiges
Löschen nach Ablauf der Frist ist **noch nicht gebaut**, weil die Frist noch nicht feststeht. Sobald
sie feststeht, baue ich es.

---

## 7. Technische und organisatorische Massnahmen

Das ist der Teil, den ich vollständig beantworten kann.

### Zugriffsschutz

- **Mandantentrennung in der Datenbank selbst**, nicht in der Anwendung. Jede Tabelle mit
  Kundendaten trägt Row-Level-Security-Regeln, die auf die Firmenkennung im Anmeldetoken prüfen.
  Ein Programmfehler in der Anwendung kann die Trennung nicht aushebeln.
- Die Regeln werden **erzeugt, nicht von Hand geschrieben** (`apply_tenant_rls()`). Eine neue
  Tabelle ohne Regeln bricht jede Migration ab (`assert_rls_complete()`).
- `FORCE ROW LEVEL SECURITY`: die Regeln gelten auch für den Tabelleneigentümer.
- **Rollen**: Owner, Admin, Berater, Backoffice — mit unterschiedlichen Schreibrechten. Das
  Backoffice kann keine Beratung abschliessen, kein Berater den Audit-Log ändern.
- **Zwei-Faktor-Anmeldung** verfügbar, pro Firma erzwingbar.

### Nachvollziehbarkeit

- **Audit-Log** über alle Tabellen mit Personendaten: wer, wann, welcher Datensatz, welche Felder.
  Für niemanden änderbar oder löschbar — auch nicht für den Owner. Das wurde eigens geprüft und
  beim ersten Versuch fiel auf, dass die erzeugten Regeln es versehentlich änderbar gemacht hatten.
- **Beratungsprotokolle sind unveränderlich**: beim Abschluss wird der Stand als JSON eingefroren
  und mit SHA-256 gesichert. Datenbanktrigger verhindern danach jede Änderung — auch das
  nachträgliche *Einfügen* einer Notiz.

### Übertragung und Speicherung

- Ausschliesslich TLS.
- Passwörter werden von Supabase Auth gehasht; die Anwendung sieht sie nie.
- **Der Generalschlüssel zur Datenbank** (Service-Rolle) ist auf eine einzige Datei beschränkt; ein
  Prüfskript in der CI bricht den Build ab, wenn er anderswo auftaucht.
- **Keine Kundendaten im Browserspeicher** ausser den Befehlen einer laufenden Beratung, die
  zwischengespeichert werden, damit ein Netzunterbruch im Gespräch nichts kostet.
- **Keine Personendaten in Protokollen**: die Protokollfunktion lässt nur gekürzte Kennungen durch.

### Entwicklung

- Jede Schemaänderung als versionierte Migration, nie von Hand auf der Produktion.
- Migrationen laufen auf Stage automatisch, auf der Produktion nur mit Freigabe.
- 348 automatische Tests, davon rund 130 gegen eine echte Datenbank — sie prüfen die
  Mandantentrennung, nicht ihre Nachbildung.

---

## 8. Was noch fehlt

| | Zuständig |
|---|---|
| Rechtsgrundlage je Zweck | Anwalt |
| Aufbewahrungsfristen festlegen | du mit Anwalt |
| Datenschutz-Folgenabschätzung: nötig? | Anwalt |
| Auftragsbearbeitungsverträge Supabase und Vercel | du |
| Datenschutzerklärung für deine Kunden | Anwalt |
| Endgültiges Löschen nach Fristablauf | ich, sobald die Frist feststeht |
| Auskunftsbegehren beantworten (Art. 25) | ich — Export je Kunde |
