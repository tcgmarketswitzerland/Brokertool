import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatCHF, rappen } from '@/domain/shared/money';
import {
  CONFIRMATION_TEXT, disclaimerText, formatShortDate, formatSwissDate, topicNarrative,
} from '@/domain/advice/protocol';
import type { SummaryDocument } from '@/domain/advice/summary';

/**
 * Das Beratungsprotokoll als PDF (docs/08-textbausteine.md, Abschnitt 2).
 *
 * Kein Farbverlauf, kein Wasserzeichen, keine Seitenrahmen: das Dokument
 * soll aussehen, als kaeme es aus einer Kanzlei, nicht aus einem
 * Serienbrief. Es ist im Streitfall ein Beweismittel und wird danach
 * beurteilt, nicht nach seiner Gestaltung.
 *
 * Gerendert wird ausschliesslich aus dem eingefrorenen SummaryDocument.
 * Damit zeigt ein Nachdruck in fuenf Jahren denselben Inhalt wie der
 * Ausdruck vom Gespraechstag - auch wenn sich seither jede Police
 * geaendert hat.
 */

const INK = '#1a1d1f';
const MUTED = '#5c6469';
const LINE = '#d7dbde';

const s = StyleSheet.create({
  // lineHeight gehoert NICHT auf die Seite: als geerbter Wert dehnt es in
  // react-pdf absolut positionierte Kinder auf die volle Seitenhoehe - die
  // Fusszeile verschwand dadurch spurlos. Deshalb steht es an den
  // Absaetzen, die es brauchen.
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 52,
          fontSize: 10, color: INK },
  paragraph: { lineHeight: 1.5 },
  overviewLine: { marginBottom: 2 },
  title: { fontSize: 19, marginBottom: 2 },
  date: { fontSize: 10, color: MUTED, marginBottom: 22 },

  metaRow: { flexDirection: 'row', marginBottom: 4 },
  metaLabel: { width: 78, color: MUTED },
  metaValue: { flex: 1 },

  section: { marginTop: 22, marginBottom: 8, paddingBottom: 4,
             borderBottomWidth: 0.7, borderBottomColor: LINE,
             fontSize: 9, letterSpacing: 0.9, color: MUTED, textTransform: 'uppercase' },

  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletMark: { width: 12, color: MUTED },
  bulletText: { flex: 1 },
  bulletDue: { color: MUTED },

  topic: { marginBottom: 14 },
  topicHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  topicName: { flex: 1, fontSize: 11 },
  topicOutcome: { color: MUTED, textAlign: 'right' },
  topicLine: { color: MUTED, marginBottom: 1 },
  topicBody: { textAlign: 'justify', lineHeight: 1.4 },

  signRow: { flexDirection: 'row', gap: 32, marginTop: 26 },
  signBox: { flex: 1 },
  signLine: { height: 46, borderBottomWidth: 0.7, borderBottomColor: INK },
  signName: { marginTop: 4 },
  signRole: { color: MUTED },

  footer: { position: 'absolute', bottom: 28, left: 52, right: 52,
            fontSize: 8, color: MUTED,
            flexDirection: 'row', justifyContent: 'space-between' },
});

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

function Bullet({ title, dueDate }: { title: string; dueDate: string | null }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletMark}>•</Text>
      <Text style={s.bulletText}>{title}</Text>
      {dueDate ? <Text style={s.bulletDue}>bis {formatShortDate(dueDate)}</Text> : null}
    </View>
  );
}

export function ProtocolDocument({
  document, contentHash,
}: {
  document: SummaryDocument;
  contentHash: string;
}) {
  const overview = [
    `${document.counts.discussed} von ${document.counts.total} Sparten besprochen`,
    document.counts.actionNeeded > 0 ? `${document.counts.actionNeeded} mit Handlungsbedarf` : null,
    document.counts.declined > 0 ? `${document.counts.declined} ausdrücklich abgelehnt` : null,
    document.counts.noAction > 0 ? `${document.counts.noAction} ohne Handlungsbedarf` : null,
    document.counts.skipped > 0 ? `${document.counts.skipped} nicht behandelt` : null,
  ].filter((line): line is string => line !== null);

  return (
    <Document
      title={`Beratungsprotokoll ${document.customerName}`}
      author={document.organizationName || document.advisorName}
    >
      <Page size="A4" style={s.page}>
        {/* Steht vor dem Inhalt, nicht dahinter: nach einem Seitenumbruch
            faellt ein fixiertes Element am Ende des Seiteninhalts weg.
            Die Dokumentkennung ist der Hash des eingefrorenen Zustands -
            ohne sie ist ein PDF nur ein Ausdruck. */}
        <View style={s.footer} fixed>
          <Text>Dokumentkennung {contentHash.slice(0, 12)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
        </View>

        <Text style={s.title}>Beratungsprotokoll</Text>
        <Text style={s.date}>{formatSwissDate(document.date)}</Text>

        <Meta label="Kunde" value={document.customerName} />
        {document.participants.length > 0 ? (
          <Meta label="Anwesend" value={document.participants.join(', ')} />
        ) : null}
        <Meta
          label="Berater"
          value={[document.advisorName, document.organizationName].filter(Boolean).join(', ')}
        />
        {document.location ? <Meta label="Ort" value={document.location} /> : null}

        <Text style={s.section}>Überblick</Text>
        {overview.map((line) => <Text key={line} style={s.overviewLine}>{line}</Text>)}
        {document.totalAnnualPremiumCents > 0 ? (
          <Text style={{ marginTop: 4, color: MUTED }}>
            Erfasste Jahresprämien: {formatCHF(rappen(document.totalAnnualPremiumCents))}
          </Text>
        ) : null}

        {/* Die offenen Punkte stehen auf Seite 1 und nicht am Ende: sie
            sind das Einzige, was der Kunde in den naechsten Tagen
            tatsaechlich braucht. */}
        {/* View statt Fragment: react-pdf kennt keine Fragmente und
            verwirft still, was darin steht - samt der fixierten
            Fusszeile. */}
        {document.customerTasks.length > 0 ? (
          <View>
            <Text style={s.section}>Ihre offenen Punkte</Text>
            {document.customerTasks.map((t) => (
              <Bullet key={t.title} title={t.title} dueDate={t.dueDate} />
            ))}
          </View>
        ) : null}

        {document.advisorTasks.length > 0 ? (
          <View>
            <Text style={s.section}>Meine offenen Punkte</Text>
            {document.advisorTasks.map((t) => (
              <Bullet key={t.title} title={t.title} dueDate={t.dueDate} />
            ))}
          </View>
        ) : null}

        <Text style={s.section}>Besprochene Sparten</Text>
        {document.topics.map((topic) => {
          const narrative = topicNarrative(topic, document);
          return (
            <View key={topic.slug} style={s.topic} wrap={false}>
              <View style={s.topicHead}>
                <Text style={s.topicName}>{topic.name}</Text>
                <Text style={s.topicOutcome}>{topic.outcomeLabel}</Text>
              </View>
              {topic.existingPolicies.map((p, i) => (
                <Text key={`${p.insurerName}-${i}`} style={s.topicLine}>
                  Bestehende Lösung: {p.insurerName}
                  {p.productName ? `, ${p.productName}` : ''}
                  {p.annualPremiumCents
                    ? `, ${formatCHF(rappen(p.annualPremiumCents))} im Jahr` : ''}
                </Text>
              ))}
              {narrative ? <Text style={s.topicBody}>{narrative}</Text> : null}
            </View>
          );
        })}

        <Text style={s.section}>Bestätigung</Text>
        <Text style={s.paragraph}>{CONFIRMATION_TEXT}</Text>

        <View style={s.signRow}>
          <View style={s.signBox}>
            <View style={s.signLine} />
            <Text style={s.signName}>{document.customerName}</Text>
            <Text style={s.signRole}>
              {document.location ? `${document.location}, ` : ''}
              {formatShortDate(document.date)}
            </Text>
          </View>
          <View style={s.signBox}>
            <View style={s.signLine} />
            <Text style={s.signName}>{document.advisorName}</Text>
            <Text style={s.signRole}>Berater</Text>
          </View>
        </View>

        <Text style={{ marginTop: 22, color: MUTED, lineHeight: 1.5 }}>
          {disclaimerText(document.date)}
        </Text>

      </Page>
    </Document>
  );
}
