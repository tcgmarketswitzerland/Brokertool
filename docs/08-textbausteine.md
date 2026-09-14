# Textbausteine

Entwürfe, die im Protokoll und in der E-Mail verwendet werden. Sie sind **änderbar** — hier steht,
wie ich sie bauen würde, damit du etwas Konkretes zum Korrigieren hast statt einer leeren Seite.

> **Rechtlicher Vorbehalt:** Diese Formulierungen sind nach bestem fachlichem Verständnis
> geschrieben, aber sie sind keine Rechtsberatung. Bevor du sie in einem echten Kundengespräch
> verwendest, gehören sie durch einen Anwalt mit Erfahrung in Versicherungsvermittlung und revDSG
> (Punkt C1 der To-do-Liste). Besonders der Ablehnungstext: seine ganze Wirkung besteht darin, im
> Streitfall zu tragen.

---

## 1. Dokumentierte Ablehnung

### Wozu dieser Satz da ist

Das ist der wichtigste Satz im ganzen Produkt. Er ist der Grund, warum ein Broker CHF 39 im Monat
zahlt, und er entscheidet im Haftungsfall.

Damit er trägt, muss er vier Dinge belegen:

1. **dass beraten wurde** — das Thema kam zur Sprache, es wurde nicht übergangen
2. **worüber aufgeklärt wurde** — konkret, nicht als Floskel
3. **dass der Kunde entschieden hat** — aus eigenem Antrieb, nicht auf Anraten des Beraters
4. **dass die Tür offen bleibt** — er kann jederzeit zurückkommen

Ein Satz wie „Kunde will nicht" belegt nichts davon.

### Der Baustein

Das System setzt ihn aus festen und beweglichen Teilen zusammen. `{…}` sind Platzhalter, die aus
der Beratung gefüllt werden; den Teil in eckigen Klammern schreibt der Berater im Gespräch.

```
Die Sparte {Sparte} wurde am {Datum} mit {Kundenname} besprochen.

{Kundenname} wurde darauf hingewiesen, dass [Sachverhalt / bestehende Lücke / Risiko].

{Kundenname} wünscht zum jetzigen Zeitpunkt ausdrücklich keine weitere Beratung und keine
Offerte zu dieser Sparte. Die Entscheidung erfolgte aus eigenem Antrieb.

{Kundenname} wurde darauf hingewiesen, dass dieses Thema jederzeit wieder aufgenommen
werden kann.
```

### Ausgefülltes Beispiel

> Die Sparte **Risiko** wurde am **15. September 2026** mit **Max und Anna Muster** besprochen.
>
> Max und Anna Muster wurden darauf hingewiesen, dass im Todesfall von Max Muster keine private
> Absicherung besteht und die Leistungen aus AHV und Pensionskasse den bisherigen Lebensstandard
> der Familie voraussichtlich nicht decken würden.
>
> Max und Anna Muster wünschen zum jetzigen Zeitpunkt ausdrücklich keine weitere Beratung und
> keine Offerte zu dieser Sparte. Die Entscheidung erfolgte aus eigenem Antrieb.
>
> Max und Anna Muster wurden darauf hingewiesen, dass dieses Thema jederzeit wieder aufgenommen
> werden kann.

### Warum genau so formuliert

| Formulierung | Grund |
|---|---|
| „wurde besprochen" statt „wurde nicht abgeschlossen" | belegt die Beratung, nicht ihr Ausbleiben |
| „wurde darauf hingewiesen, dass …" | benennt den Inhalt der Aufklärung — der Kern des Belegs |
| **„ausdrücklich"** | grenzt gegen blosses Schweigen ab |
| **„zum jetzigen Zeitpunkt"** | die Ablehnung gilt für heute, nicht für immer |
| „aus eigenem Antrieb" | wehrt den Vorwurf ab, der Berater habe abgeraten |
| „kann jederzeit wieder aufgenommen werden" | zeigt, dass die Beratung nicht beendet wurde |

### Was der Berater ausfüllen muss

Der Satz in eckigen Klammern ist **Pflicht**, wenn eine Ablehnung dokumentiert wird. Ohne ihn
belegt das Protokoll nur, dass etwas abgelehnt wurde, nicht worüber aufgeklärt wurde — und genau
darauf kommt es an. Die Anwendung wird ihn deshalb verlangen, bevor „Kunde lehnt ab" gespeichert
werden kann.

### Auch bei „Später anschauen"

Dort ist eine leichtere Variante angebracht, weil es keine Ablehnung ist:

```
Die Sparte {Sparte} wurde am {Datum} angesprochen. {Kundenname} möchte das Thema zu einem
späteren Zeitpunkt vertiefen. [Notiz des Beraters]
```

### Bei „Übersprungen"

Wenn eine Sparte übersprungen wird, hält das Protokoll fest, dass sie nicht besprochen wurde —
ohne zu behaupten, es habe eine Beratung stattgefunden:

```
Die Sparte {Sparte} wurde im Gespräch vom {Datum} nicht behandelt.
```

Das ist ehrlicher als jede Umschreibung und schützt den Berater besser als eine Formulierung, die
nach Beratung klingt.

---

## 2. Beratungsprotokoll

### Aufbau

Zwei bis vier Seiten, je nach Umfang. Die Reihenfolge folgt dem, was der Kunde später sucht —
nicht der internen Datenstruktur.

```
┌─ Seite 1 ────────────────────────────────────────────────┐
│  [Logo]                                                  │
│                                                          │
│  Beratungsprotokoll                                      │
│  15. September 2026                                      │
│                                                          │
│  Kunde       Max und Anna Muster                         │
│              Musterstrasse 1, 8000 Zürich                │
│  Beraten     Max Muster, Anna Muster                     │
│  Berater     Peter Muster, Muster Broker AG              │
│  Ort         beim Kunden                                 │
│                                                          │
│  ── Überblick ────────────────────────────────────────   │
│  11 von 11 Sparten besprochen                            │
│   3 mit Handlungsbedarf                                  │
│   1 ausdrücklich abgelehnt                               │
│   7 ohne Handlungsbedarf                                 │
│                                                          │
│  ── Ihre offenen Punkte ──────────────────────────────   │
│  • Pensionskassenausweis zustellen        bis 30.09.     │
│  • Fahrzeugausweis senden                 bis 30.09.     │
│                                                          │
│  ── Meine offenen Punkte ─────────────────────────────   │
│  • Offerte Hausrat mit höherer Fahrraddeckung  bis 22.09.│
│  • Rechtsschutz vergleichen                    bis 25.09.│
└──────────────────────────────────────────────────────────┘

┌─ Seite 2 und folgende ───────────────────────────────────┐
│  ── Besprochene Sparten ──────────────────────────────   │
│                                                          │
│  [Symbol] Hausratversicherung        Offerte gewünscht   │
│           Bestehende Lösung: AXA, CHF 480 im Jahr        │
│           Kunde möchte höhere Deckung für Fahrräder      │
│           und elektronische Geräte.                      │
│                                                          │
│  [Symbol] Privathaftpflicht     Kein Handlungsbedarf     │
│           Bestehende Lösung: AXA, CHF 120 im Jahr        │
│           Deckung geprüft und ausreichend.               │
│                                                          │
│  [Symbol] Risiko                     Kunde lehnt ab      │
│           Keine Deckung vorhanden                        │
│           Die Sparte Risiko wurde am 15.09.2026 mit      │
│           Max und Anna Muster besprochen. … (voller      │
│           Ablehnungstext von oben)                       │
│                                                          │
│  …                                                        │
└──────────────────────────────────────────────────────────┘

┌─ Letzte Seite ───────────────────────────────────────────┐
│  ── Bestätigung ──────────────────────────────────────   │
│                                                          │
│  Ich bestätige, dass die oben aufgeführten Themen mit    │
│  mir besprochen wurden und dass meine Entscheidungen     │
│  richtig wiedergegeben sind.                             │
│                                                          │
│  ┌──────────────────┐        ┌──────────────────┐        │
│  │  [Unterschrift]  │        │  [Unterschrift]  │        │
│  └──────────────────┘        └──────────────────┘        │
│  Max Muster                  Peter Muster                │
│  Zürich, 15.09.2026          Berater                     │
│                                                          │
│  ── Hinweise ─────────────────────────────────────────   │
│  Dieses Protokoll gibt das Gespräch vom 15.09.2026       │
│  wieder. Es ersetzt keine Police und begründet keinen    │
│  Versicherungsschutz.                                    │
│                                                          │
│  Dokumentkennung  a3f8…c21                               │
│  Erstellt         15.09.2026 16:42                       │
└──────────────────────────────────────────────────────────┘
```

### Entwurfsentscheidungen

**Die offenen Punkte stehen auf Seite 1, nicht am Ende.** Das ist das Einzige, was der Kunde in
den nächsten Tagen tatsächlich braucht. Ein Protokoll, bei dem er dafür bis Seite 3 blättern muss,
wird nicht benutzt.

**Zuerst die Aufgaben des Kunden, dann die des Beraters.** In dieser Reihenfolge, weil der Kunde
zuerst wissen will, was von ihm erwartet wird — und weil es zeigt, dass der Berater sich auch
etwas vorgenommen hat.

**Übersprungene Sparten stehen mit drin.** Wenn elf Sparten Pflicht sind und eine nicht behandelt
wurde, gehört das ins Protokoll. Alles andere wäre eine Lücke, die später niemand erklären kann.

**Interne Notizen erscheinen nie.** Weder im PDF noch in der E-Mail. Das ist in der Datenbank als
eigenes Feld angelegt und wird an genau einer Stelle gefiltert.

**Die Dokumentkennung ist der Hash des eingefrorenen Zustands.** Damit lässt sich jederzeit
belegen, dass ein vorgelegtes PDF dem entspricht, was beim Abschluss festgehalten wurde. Ohne sie
ist ein PDF nur ein Ausdruck.

**Kein Farbverlauf, kein Wasserzeichen, keine Seitenrahmen.** Das Protokoll soll aussehen, als
käme es aus einer Kanzlei, nicht aus einem Serienbrief.

---

## 3. Abschluss-E-Mail

```
Betreff: Unser Gespräch vom 15. September 2026

Guten Tag Herr Muster

Vielen Dank für das Gespräch von heute. Anbei finden Sie das Protokoll mit allen
besprochenen Themen.

Kurz zusammengefasst:

  • Hausratversicherung — ich erstelle Ihnen eine Offerte mit höherer Fahrraddeckung
  • Motorfahrzeugversicherung — wir prüfen einen Wechsel per 31.12.
  • Rechtsschutz — ich vergleiche drei Anbieter für Sie

Ihre offenen Punkte:

  • Pensionskassenausweis zustellen (bis 30.09.)
  • Fahrzeugausweis senden (bis 30.09.)

Meine offenen Punkte:

  • Offerte Hausrat (bis 22.09.)
  • Rechtsschutz vergleichen (bis 25.09.)

Bei Fragen melden Sie sich jederzeit.

Freundliche Grüsse
Peter Muster
Muster Broker AG
```

**Was bewusst nicht drinsteht:** die abgelehnten Themen. Sie stehen im Protokoll, wo sie
hingehören — sie in der E-Mail zu wiederholen liest sich wie Nachfassen und beschädigt das
Vertrauen, das im Gespräch entstanden ist.

Der Berater kann jede E-Mail vor dem Versand ändern.

---

## 4. Disclaimer Vorsorgeanalyse

```
Diese Auswertung ist eine Grobanalyse auf Grundlage der im Gespräch genannten Angaben.
Sie beruht auf den gesetzlichen Grundlagen des Jahres {Jahr} und auf folgenden Annahmen:
{Annahmen}.

Sie ersetzt weder eine Berechnung Ihrer Vorsorgeeinrichtung noch eine verbindliche
Leistungszusage eines Versicherers. Massgebend sind ausschliesslich die Angaben Ihrer
Vorsorgeeinrichtung und die Bedingungen Ihrer Policen.
```

Der Verweis auf Jahr und Annahmen ist kein Beiwerk: Er ist der Grund, warum die Analyse in fünf
Jahren noch nachvollziehbar ist. Die verwendeten gesetzlichen Parameter werden mit der Analyse
gespeichert.
