import { describe, expect, it } from 'vitest';
import { buildSummary, type SummaryInput } from '@/domain/advice/summary';
import { buildDeclineText, buildSkippedText } from '@/domain/advice/decline-text';

const base: SummaryInput = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  date: '15.09.2026',
  customerName: 'Max und Anna Muster',
  participants: ['Max Muster', 'Anna Muster'],
  advisorName: 'Peter Muster',
  organizationName: 'Muster Broker AG',
  organization: {
    street: 'Bahnhofstrasse 1', postalCode: '8001', city: 'Zürich',
    phone: '044 123 45 67', email: 'beratung@muster.ch',
    website: 'https://muster.ch', finmaNumber: 'F01234567',
  },
  location: 'beim Kunden',
  topics: [
    { topicId: 't1', slug: 'hausrat', name: 'Hausratversicherung', icon: 'sofa',
      displayOrder: 10, isRequired: true, progressStatus: 'DISCUSSED',
      outcome: 'OFFER_REQUESTED', coverageState: 'COVER_EXISTS' },
    { topicId: 't2', slug: 'risiko', name: 'Risiko', icon: 'umbrella',
      displayOrder: 20, isRequired: true, progressStatus: 'DISCUSSED',
      outcome: 'CLIENT_DECLINED', coverageState: 'NO_COVER' },
    { topicId: 't3', slug: 'reise', name: 'Reise', icon: 'plane',
      displayOrder: 30, isRequired: true, progressStatus: 'SKIPPED',
      outcome: null, coverageState: 'UNKNOWN' },
  ],
  policies: [
    { topicId: 't1', insurerName: 'AXA', productName: 'Hausrat Komfort', annualPremiumCents: 48_000 },
  ],
  notes: [
    { topicId: 't1', visibility: 'SHARED', body: 'Kunde möchte höhere Fahrraddeckung.' },
    { topicId: 't1', visibility: 'INTERNAL', body: 'Wirkt unentschlossen, nachfassen.' },
    { topicId: 't2', visibility: 'SHARED', body: 'Auf Vorsorgelücke hingewiesen.' },
  ],
  tasks: [
    { ownerType: 'CUSTOMER', title: 'Pensionskassenausweis senden', dueDate: '2026-09-30' },
    { ownerType: 'ADVISOR', title: 'Hausrat-Offerte erstellen', dueDate: '2026-09-22' },
    { ownerType: 'ADVISOR', title: 'Rechtsschutz vergleichen', dueDate: null },
  ],
  pension: null,
};

describe('Protokolldokument', () => {
  const doc = buildSummary(base);

  it('filtert interne Notizen heraus — an genau dieser einen Stelle', () => {
    // Berater und Kunde schauen auf denselben Bildschirm. Eine interne Notiz
    // im Kunden-PDF ist ein Vorfall, der ein Konto kostet.
    const alleTexte = JSON.stringify(doc);
    expect(alleTexte).not.toContain('Wirkt unentschlossen');
    expect(alleTexte).toContain('höhere Fahrraddeckung');
  });

  it('nennt eine übersprungene Sparte "Nicht thematisiert", nicht "Offen"', () => {
    // Eine Formulierung, die nach Beratung klingt, schadet dem Berater mehr
    // als die Wahrheit.
    expect(doc.topics.find((t) => t.slug === 'reise')?.outcomeLabel).toBe('Nicht thematisiert');
  });

  it('sortiert nach der Reihenfolge des Gesprächs', () => {
    expect(doc.topics.map((t) => t.slug)).toEqual(['hausrat', 'risiko', 'reise']);
  });

  it('zählt die Ergebnisse', () => {
    expect(doc.counts).toEqual({
      total: 3, discussed: 2, actionNeeded: 1, declined: 1, noAction: 0, skipped: 1,
    });
  });

  it('trennt Kunden- und Berateraufgaben', () => {
    expect(doc.customerTasks).toEqual([
      { title: 'Pensionskassenausweis senden', dueDate: '2026-09-30' },
    ]);
    expect(doc.advisorTasks).toHaveLength(2);
  });

  it('ordnet bestehende Verträge der richtigen Sparte zu', () => {
    expect(doc.topics[0]?.existingPolicies).toEqual([
      { insurerName: 'AXA', productName: 'Hausrat Komfort', annualPremiumCents: 48_000 },
    ]);
    expect(doc.topics[1]?.existingPolicies).toEqual([]);
  });

  it('summiert die Jahresprämien', () => {
    expect(doc.totalAnnualPremiumCents).toBe(48_000);
  });

  it('ist ohne Zugriff auf andere Tabellen lesbar', () => {
    // Das Dokument wird beim Abschluss eingefroren und ist danach die
    // rechtlich massgebliche Fassung. Verweise auf Kennungen statt Namen
    // waeren in fuenf Jahren wertlos.
    expect(doc.customerName).toBe('Max und Anna Muster');
    expect(doc.advisorName).toBe('Peter Muster');
    expect(doc.topics.every((t) => t.name.length > 0)).toBe(true);
  });

  it('trägt eine Schemaversion', () => {
    expect(doc.schemaVersion).toBe(1);
  });

  it('bleibt bei gleicher Eingabe gleich — Voraussetzung für den Hash', () => {
    expect(JSON.stringify(buildSummary(base))).toBe(JSON.stringify(doc));
  });
});

describe('Dokumentierte Ablehnung', () => {
  const text = buildDeclineText({
    topicName: 'Risiko',
    date: '15.09.2026',
    customerName: 'Max Muster',
    advice: 'im Todesfall keine private Absicherung besteht',
  });

  it('belegt, dass beraten wurde', () => {
    expect(text).toContain('wurde am 15.09.2026 mit Max Muster besprochen');
  });

  it('nennt, worüber aufgeklärt wurde', () => {
    expect(text).toContain('wurde darauf hingewiesen, dass im Todesfall keine private Absicherung besteht');
  });

  it('grenzt gegen blosses Schweigen ab', () => {
    expect(text).toContain('ausdrücklich');
  });

  it('begrenzt die Ablehnung auf den heutigen Tag', () => {
    expect(text).toContain('zum jetzigen Zeitpunkt');
  });

  it('wehrt den Vorwurf ab, der Berater habe abgeraten', () => {
    expect(text).toContain('aus eigenem Antrieb');
  });

  it('hält fest, dass die Tür offen bleibt', () => {
    expect(text).toContain('jederzeit wieder aufgenommen werden kann');
  });

  it('räumt doppelte Satzzeichen und Leerraum auf', () => {
    const t = buildDeclineText({
      topicName: 'Cyber', date: '01.01.2026', customerName: 'Anna Muster',
      advice: '  kein   Schutz   besteht.  ',
    });
    expect(t).toContain('dass kein Schutz besteht.');
    expect(t).not.toContain('..');
  });
});

describe('Übersprungene Sparte', () => {
  it('behauptet keine Beratung', () => {
    const t = buildSkippedText('Hypothek', '15.09.2026');
    expect(t).toBe('Die Sparte Hypothek wurde im Gespräch vom 15.09.2026 nicht thematisiert.');
    expect(t).not.toContain('besprochen');
  });
});
