import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildEmailDraft } from '@/domain/advice/email';
import { formatShortDate, formatSwissDate, topicNarrative } from '@/domain/advice/protocol';
import type { SummaryDocument, SummaryTopic } from '@/domain/advice/summary';
import { ProtocolDocument } from '@/features/protocol/pdf-document';

function topic(over: Partial<SummaryTopic> = {}): SummaryTopic {
  return {
    slug: 'risiko', name: 'Risiko', icon: 'heart-pulse',
    outcome: 'NO_ACTION_NEEDED', outcomeLabel: 'Kein Handlungsbedarf',
    coverageState: 'COVER_EXISTS', wasSkipped: false, existingPolicies: [], note: null,
    ...over,
  };
}

const DOC: SummaryDocument = {
  schemaVersion: 1,
  sessionId: '11111111-1111-4111-8111-111111111111',
  date: '2026-09-15',
  customerName: 'Max und Anna Muster',
  participants: ['Max Muster', 'Anna Muster'],
  advisorName: 'Peter Muster',
  organizationName: 'Muster Broker AG',
  location: 'beim Kunden',
  counts: { total: 11, discussed: 10, actionNeeded: 3, declined: 1, noAction: 6, skipped: 1 },
  topics: [
    topic({
      slug: 'hausrat', name: 'Hausratversicherung', outcome: 'OFFER_REQUESTED',
      outcomeLabel: 'Offerte gewünscht',
      existingPolicies: [{ insurerName: 'AXA', productName: null, annualPremiumCents: 48_000 }],
      note: 'Kunde möchte höhere Deckung für Fahrräder.',
    }),
    topic({
      outcome: 'CLIENT_DECLINED', outcomeLabel: 'Kunde lehnt ab', coverageState: 'NO_COVER',
      note: 'im Todesfall keine private Absicherung besteht',
    }),
    topic({
      slug: 'cyber', name: 'Cyberversicherung', outcome: null,
      outcomeLabel: 'Nicht behandelt', wasSkipped: true, coverageState: 'UNKNOWN',
    }),
  ],
  customerTasks: [{ title: 'Pensionskassenausweis zustellen', dueDate: '2026-09-30' }],
  advisorTasks: [{ title: 'Offerte einholen: Hausratversicherung', dueDate: '2026-09-22' }],
  totalAnnualPremiumCents: 48_000,
};

describe('Datumsformate', () => {
  it('schreibt das Datum im Protokoll aus', () => {
    expect(formatSwissDate('2026-09-15')).toBe('15. September 2026');
  });

  it('kuerzt es fuer Fristen', () => {
    expect(formatShortDate('2026-09-15')).toBe('15.09.2026');
  });

  it('gibt Unbrauchbares unveraendert zurueck, statt zu raten', () => {
    expect(formatSwissDate('kein Datum')).toBe('kein Datum');
  });
});

describe('Spartentext im Protokoll', () => {
  it('setzt bei Ablehnung den vollen Baustein', () => {
    const text = topicNarrative(DOC.topics[1]!, DOC) ?? '';
    // Die vier Belege aus docs/08-textbausteine.md - fehlt einer, traegt
    // der Text im Streitfall nicht.
    expect(text).toContain('wurde am 15. September 2026 mit Max und Anna Muster besprochen');
    expect(text).toContain('wurden darauf hingewiesen, dass im Todesfall keine private Absicherung besteht.');
    expect(text).toContain('ausdrücklich keine weitere Beratung');
    expect(text).toContain('aus eigenem Antrieb');
    expect(text).toContain('jederzeit wieder aufgenommen werden kann');
  });

  it('beugt den Satz auf ein Ehepaar', () => {
    // "Max und Anna Muster wurde darauf hingewiesen" ist falsches Deutsch -
    // und der Satz wird von beiden gelesen.
    const text = topicNarrative(DOC.topics[1]!, DOC) ?? '';
    expect(text).toContain('Max und Anna Muster wurden darauf hingewiesen');
    expect(text).toContain('Max und Anna Muster wünschen zum jetzigen Zeitpunkt');
  });

  it('bleibt bei einer einzelnen Person im Singular', () => {
    const text = topicNarrative(DOC.topics[1]!, { ...DOC, customerName: 'Max Muster' }) ?? '';
    expect(text).toContain('Max Muster wurde darauf hingewiesen');
    expect(text).toContain('Max Muster wünscht zum jetzigen Zeitpunkt');
  });

  it('taeuscht ohne Hinweis keinen Beleg vor', () => {
    const text = topicNarrative(topic({ outcome: 'CLIENT_DECLINED', note: null }), DOC) ?? '';
    expect(text).toContain('besprochen');
    expect(text).not.toContain('hingewiesen, dass');
  });

  it('sagt bei einer uebersprungenen Sparte, dass nicht beraten wurde', () => {
    expect(topicNarrative(DOC.topics[2]!, DOC))
      .toBe('Die Sparte Cyberversicherung wurde im Gespräch vom 15. September 2026 nicht behandelt.');
  });

  it('uebernimmt sonst die Notiz des Beraters unveraendert', () => {
    expect(topicNarrative(DOC.topics[0]!, DOC))
      .toBe('Kunde möchte höhere Deckung für Fahrräder.');
  });
});

describe('Abschluss-E-Mail', () => {
  const draft = buildEmailDraft(DOC);

  it('nennt im Betreff das Gespraechsdatum', () => {
    expect(draft.subject).toBe('Unser Gespräch vom 15. September 2026');
  });

  it('nennt die Aufgaben des Kunden vor den eigenen', () => {
    expect(draft.body.indexOf('Ihre offenen Punkte'))
      .toBeLessThan(draft.body.indexOf('Meine offenen Punkte'));
  });

  it('nennt die Fristen', () => {
    expect(draft.body).toContain('Pensionskassenausweis zustellen (bis 30.09.2026)');
  });

  it('wiederholt die abgelehnte Sparte nicht', () => {
    // Sie steht im Protokoll. In der E-Mail liest sie sich wie Nachfassen.
    expect(draft.body).not.toContain('Risiko');
    expect(draft.body).not.toContain('lehnt ab');
  });

  it('schliesst mit Berater und Firma', () => {
    expect(draft.body.trimEnd().endsWith('Peter Muster\nMuster Broker AG')).toBe(true);
  });
});

describe('PDF', () => {
  it('rendert ein vollstaendiges Dokument', async () => {
    const buffer = await renderToBuffer(
      ProtocolDocument({ document: DOC, contentHash: 'a'.repeat(64) }));
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(2000);
  }, 30_000);
});
