# Designsystem

Stand: 2026-09-14. Referenzseite im Betrieb unter `/design`.

---

## Haltung

Der Berater sitzt mit dem Kunden vor dem Gerät. Die Oberfläche muss präsentabel sein, ohne
dekorativ zu wirken — ein Werkzeug, das Kompetenz ausstrahlt, keine Marketingseite. Das Gegenteil
davon ist eine Oberfläche, die aussieht wie aus dem Baukasten.

Fünf Entscheidungen tragen das Erscheinungsbild:

**Kanten statt Schatten.** Flächen werden durch Linien getrennt, nicht durch weiche Schattenwolken.
Schatten gibt es nur dort, wo etwas wirklich über der Seite schwebt: Menüs und Dialoge. Der
allgegenwärtige weiche Schatten unter jeder Karte ist das häufigste Merkmal generischer
Oberflächen.

**Keine Farbverläufe.** Nirgends, als Dekoration. Ein Verlauf ist hier immer ein Datenverlauf, nie
Schmuck.

**Eine Akzentfarbe, sparsam.** Ein tiefes Tintenblau, nicht das übliche Signalblau und kein
Violett. Farbe bedeutet in dieser Anwendung etwas — einen Status, eine Aktion — und wird nie
verteilt, weil eine Fläche sonst leer wirkt. Pro Ansicht gibt es genau eine kräftige Aktion; sobald
zwei Schaltflächen um Aufmerksamkeit kämpfen, trifft der Nutzer keine Entscheidung mehr.

**Tabellenziffern für alle Beträge.** Prämien in einer Spalte müssen untereinander fluchten. Das
ist der Unterschied zwischen einer Offertvergleichstabelle, die man lesen kann, und einer, die man
entziffern muss.

**Symbole aus einem Icon-Satz, nie Emoji.** Emoji in einer Finanzanwendung wirken unseriös und
sehen auf jedem Betriebssystem anders aus.

## Typografie

Inter Variable, **selbst gehostet** über `@fontsource-variable/inter`. Bewusst nicht über den
Google-Fonts-CDN: der überträgt bei jedem Seitenaufruf die IP der Nutzer an Google. Bei einem
Werkzeug für Versicherungs- und Vorsorgedaten ist das eine unnötige Position in der
Datenschutzerklärung.

- Überschriften mit negativer Laufweite (−0.021em, bei H1 −0.028em), damit grosse Grade nicht
  auseinanderfallen
- `text-wrap: balance` für Überschriften, `pretty` für Fliesstext
- OpenType `cv05` und `ss03` für ein offeneres l und ein geschwungenes g — kleine Abweichung vom
  Standard-Inter, die dem Text Charakter gibt, ohne aufzufallen
- `font-synthesis-weight: none`: kein künstlich verfetteter Text, wenn ein Schnitt fehlt

## Farben

Alle Werte in OKLCH. Der Grund ist nicht Modernität, sondern Praxis: In OKLCH bedeutet dieselbe
Helligkeitszahl über verschiedene Farbtöne hinweg auch dieselbe wahrgenommene Helligkeit. Eine
Statuspalette aus sechs Farben lässt sich damit so bauen, dass keine Farbe heraussticht oder
untergeht — in HSL ist das Handarbeit.

Struktur der Token: Rohwerte als CSS-Variablen in `:root`, gespiegelt für den Dunkelmodus, und über
`@theme inline` als Tailwind-Farben verfügbar. Jede Farbe ist genau einmal je Modus definiert.

### Helles und dunkles Schema

Drei Zustände, wie es sich gehört:

| Zustand | Verhalten |
|---|---|
| `system` (Vorgabe) | folgt `prefers-color-scheme` |
| `light` | `data-theme="light"` überschreibt die Systemeinstellung |
| `dark` | `data-theme="dark"` überschreibt die Systemeinstellung |

Ein eingebettetes Skript im `<head>` setzt das Attribut vor dem ersten Anstrich. Das ist die
einzige Stelle im Projekt mit Inline-Skript — jede andere Lösung erzeugt ein sichtbares Aufblitzen
im falschen Modus beim Laden.

Der Umschalter liest den Speicher über `useSyncExternalStore`, nicht über `useState` mit Effekt.
localStorage *ist* ein externer Speicher; das ist die dafür vorgesehene Schnittstelle und vermeidet
zugleich den Hydrationskonflikt.

Die Themewahl ist eine reine Anzeigeeinstellung ohne Personenbezug und darf deshalb im Browser
liegen — im Unterschied zu allem, was ADR-002 regelt.

### Beratungsstatus

Sechs Zustände, jeder mit **Farbe und Symbol**. Farbe allein genügt nicht: Rot und Grün sind für
einen relevanten Teil der Nutzer nicht unterscheidbar, und das Beratungsrad wird dem Kunden
gezeigt. Doppelte Kodierung ist hier keine Kür, sondern Voraussetzung dafür, dass das zentrale
UX-Element seine Aufgabe erfüllt.

| Status | Symbol |
|---|---|
| Nicht besprochen | gestrichelter Kreis |
| In Bearbeitung | gefüllter Punkt im Kreis |
| Kein Handlungsbedarf | Haken |
| Handlungsbedarf | Minus im Kreis |
| Kunde lehnt ab | durchgestrichener Kreis |
| Wiedervorlage | Uhr |

Dieselben Token gelten für Rad, Liste, Kennzeichnungen **und das PDF** — das gedruckte Protokoll
spricht dieselbe visuelle Sprache wie der Bildschirm.

## Geräte

| Gerät | Rolle | Umsetzung |
|---|---|---|
| Notebook | Büroarbeit, Nacherfassung, Auswertungen | Standarddichte |
| iPad | Kundengespräch — das wichtigste Gerät | eigene Dichtestufe `data-density="advisor"`, Bedienelemente mindestens 48 px |
| Smartphone | nachrangig | funktionsfähig, aber nicht auf Formularerfassung optimiert |

Zwei Details, die auf dem iPad sonst stören:

- Eingabefelder haben unterhalb der `sm`-Grenze 16 px Schriftgrösse. Alles darunter lässt iPadOS
  und iOS beim Fokussieren in das Feld hineinzoomen.
- `viewport` erlaubt weiterhin Zoom. Ihn zu sperren wäre ein Barrierefreiheitsfehler — besonders
  bei einem Werkzeug, bei dem ein Kunde mitliest.

## Bausteine

In `src/components/ui`: `Button`, `Input`, `Textarea`, `Field`, `Label`, `Card`, `Badge`, `Alert`,
`Logo`.

Bewusst **nicht** die Standardvarianten von shadcn/ui übernommen. Die Primitives von Radix liegen
darunter, aber die Gestaltung ist eigen — die unveränderten Vorgaben sind ein wesentlicher Grund,
warum sich viele neue Anwendungen gleich anfühlen.

`Field` verbindet Beschriftung, Hinweis und Fehlermeldung über `aria-describedby`. Ohne diese
Klammer wird die Verknüpfung erfahrungsgemäss irgendwann vergessen, und Barrierefreiheit ist in
Konzeptpunkt 34 ausdrücklich gefordert.

## Prüfung

Die Seite `/design` zeigt alle Bausteine in beiden Schemata auf einer Seite. Zweck: Abweichungen
fallen dort auf, bevor sie sich über zwanzig Ansichten verteilen. Sie gehört vor jeder grösseren
Änderung am Designsystem einmal in beiden Modi angeschaut — auf dem iPad, nicht im
Browser-Emulator.
