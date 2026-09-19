/**
 * Die erfundenen Kunden. Framework-frei, damit sie sich lesen und
 * pruefen lassen, ohne die Datenbank zu starten.
 *
 * Bewusst Schweizer Verhaeltnisse mit plausiblen Zahlen: eine Familie in
 * Winterthur mit Hausrat bei der Mobiliar, ein Paar in Zug, ein
 * Selbstaendiger in Luzern. Wer die Demodaten anschaut, soll erkennen,
 * wofuer das Werkzeug gedacht ist - nicht "Max Mustermann, Teststrasse 1".
 */

export type DemoPerson = {
  readonly role: 'PRIMARY' | 'PARTNER' | 'CHILD';
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string;
  readonly sex: 'FEMALE' | 'MALE' | 'UNSPECIFIED';
  readonly annualIncomeFranken?: number;
  readonly occupation?: string;
};

export type DemoPolicy = {
  readonly topicSlug: string;
  readonly insurerName: string;
  readonly productName?: string;
  readonly premiumFranken: number;
  readonly frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';
};

export type DemoCustomer = {
  readonly type: 'PRIVATE' | 'COUPLE' | 'FAMILY';
  readonly postalCode: string;
  readonly city: string;
  readonly street: string;
  readonly persons: readonly DemoPerson[];
  readonly policies: readonly DemoPolicy[];
};

export const DEMO_CUSTOMERS: readonly DemoCustomer[] = [
  {
    type: 'FAMILY',
    postalCode: '8400', city: 'Winterthur', street: 'Tösstalstrasse 42',
    persons: [
      { role: 'PRIMARY', firstName: 'Nadja', lastName: 'Brunner',
        dateOfBirth: '1986-04-12', sex: 'FEMALE',
        annualIncomeFranken: 96_000, occupation: 'Pflegefachfrau' },
      { role: 'PARTNER', firstName: 'Simon', lastName: 'Brunner',
        dateOfBirth: '1984-11-03', sex: 'MALE',
        annualIncomeFranken: 112_000, occupation: 'Bauleiter' },
      { role: 'CHILD', firstName: 'Lina', lastName: 'Brunner',
        dateOfBirth: '2016-07-21', sex: 'FEMALE' },
      { role: 'CHILD', firstName: 'Noah', lastName: 'Brunner',
        dateOfBirth: '2019-02-08', sex: 'MALE' },
    ],
    policies: [
      { topicSlug: 'hausrat', insurerName: 'Die Mobiliar',
        productName: 'Hausrat Komfort', premiumFranken: 486, frequency: 'YEARLY' },
      { topicSlug: 'privathaftpflicht', insurerName: 'Die Mobiliar',
        premiumFranken: 152, frequency: 'YEARLY' },
      { topicSlug: 'krankenkasse', insurerName: 'Helsana',
        productName: 'BENEFIT Standard', premiumFranken: 412, frequency: 'MONTHLY' },
      { topicSlug: 'motorfahrzeug', insurerName: 'AXA',
        productName: 'Vollkasko', premiumFranken: 1_240, frequency: 'YEARLY' },
    ],
  },
  {
    type: 'COUPLE',
    postalCode: '6340', city: 'Baar', street: 'Zugerstrasse 18',
    persons: [
      { role: 'PRIMARY', firstName: 'Elena', lastName: 'Kovač',
        dateOfBirth: '1991-09-30', sex: 'FEMALE',
        annualIncomeFranken: 104_000, occupation: 'Softwareentwicklerin' },
      { role: 'PARTNER', firstName: 'Tobias', lastName: 'Ricci',
        dateOfBirth: '1990-01-17', sex: 'MALE',
        annualIncomeFranken: 88_000, occupation: 'Lehrer' },
    ],
    policies: [
      { topicSlug: 'hausrat', insurerName: 'Zurich',
        premiumFranken: 318, frequency: 'YEARLY' },
      { topicSlug: 'krankenkasse', insurerName: 'CSS',
        productName: 'Basic', premiumFranken: 398, frequency: 'MONTHLY' },
    ],
  },
  {
    type: 'PRIVATE',
    postalCode: '6003', city: 'Luzern', street: 'Hirschmattstrasse 7',
    persons: [
      { role: 'PRIMARY', firstName: 'Peter', lastName: 'Achermann',
        dateOfBirth: '1972-06-05', sex: 'MALE',
        annualIncomeFranken: 145_000, occupation: 'Selbstständiger Schreiner' },
    ],
    policies: [
      { topicSlug: 'privathaftpflicht', insurerName: 'Baloise',
        premiumFranken: 128, frequency: 'YEARLY' },
    ],
  },
];

/**
 * Was im Demo-Gespraech herauskam.
 *
 * Absichtlich gemischt: eine bestellte Offerte, ein "kein Handlungsbedarf
 * seitens Broker" und eine dokumentierte Ablehnung. Nur so zeigt das
 * Protokoll, wozu es da ist.
 */
export type DemoOutcome = {
  readonly topicSlug: string;
  readonly outcome: 'OFFER_REQUESTED' | 'NO_ACTION_NEEDED' | 'CLIENT_DECLINED' | 'ACTION_REQUIRED';
  readonly coverage: 'COVER_EXISTS' | 'NO_COVER' | 'UNKNOWN';
  readonly note: string;
};

export const DEMO_OUTCOMES: readonly DemoOutcome[] = [
  { topicSlug: 'hausrat', outcome: 'ACTION_REQUIRED', coverage: 'COVER_EXISTS',
    note: 'Die Deckungssumme stammt aus dem Jahr 2019. Seither sind zwei E-Bikes und '
        + 'eine Fotoausrüstung dazugekommen; die Summe wird überprüft.' },
  { topicSlug: 'privathaftpflicht', outcome: 'NO_ACTION_NEEDED', coverage: 'COVER_EXISTS',
    note: 'Deckung von 5 Mio. ist für die Familiensituation ausreichend.' },
  { topicSlug: 'krankenkasse', outcome: 'OFFER_REQUESTED', coverage: 'COVER_EXISTS',
    note: 'Prämienvergleich für die Region gezeigt. Offerte für ein Hausarztmodell '
        + 'mit Franchise 2500 wird eingeholt.' },
  { topicSlug: 'risiko', outcome: 'CLIENT_DECLINED', coverage: 'NO_COVER',
    note: 'im Todesfall eines Elternteils die Hypothek nicht aus den verbleibenden '
        + 'Einkünften und den Leistungen der 1. und 2. Säule getragen werden kann' },
];
