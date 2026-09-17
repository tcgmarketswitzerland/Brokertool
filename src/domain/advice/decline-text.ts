/**
 * Die dokumentierte Ablehnung (docs/08-textbausteine.md).
 *
 * Der wichtigste Satz im ganzen Produkt: er entscheidet im Haftungsfall.
 * Damit er traegt, muss er vier Dinge belegen - dass beraten wurde,
 * worueber aufgeklaert wurde, dass der Kunde aus eigenem Antrieb
 * entschieden hat, und dass das Thema jederzeit wieder aufgenommen werden
 * kann. "Kunde will nicht" belegt nichts davon.
 */

export type DeclineInput = {
  readonly topicName: string;
  readonly date: string;
  readonly customerName: string;
  /** Worueber aufgeklaert wurde. Ohne diesen Teil belegt der Text nichts. */
  readonly advice: string;
};

/**
 * Ob der Kundenname mehrere Personen bezeichnet.
 *
 * "Max und Anna Muster wurde darauf hingewiesen" ist falsches Deutsch, und
 * der Satz wird vom Kunden gelesen - bei einem Ehepaar also von zwei
 * Personen, die den Fehler beide sehen. Der Name ist die einzige
 * verlaessliche Quelle dafuer: die Teilnehmerliste kann eine einzelne
 * Person mit Begleitung enthalten.
 */
function isPlural(customerName: string): boolean {
  return / und |, | & /.test(customerName);
}

export function buildDeclineText(input: DeclineInput): string {
  const advice = input.advice.trim().replace(/\s+/g, ' ').replace(/\.$/, '');
  const plural = isPlural(input.customerName);
  const name = input.customerName;
  const wurde = plural ? 'wurden' : 'wurde';
  const wuenscht = plural ? 'wünschen' : 'wünscht';

  return [
    `Die Sparte ${input.topicName} wurde am ${input.date} mit ${name} besprochen.`,
    `${name} ${wurde} darauf hingewiesen, dass ${advice}.`,
    `${name} ${wuenscht} zum jetzigen Zeitpunkt ausdrücklich keine weitere Beratung `
      + `und keine Offerte zu dieser Sparte. Die Entscheidung erfolgte aus eigenem Antrieb.`,
    `${name} ${wurde} darauf hingewiesen, dass dieses Thema jederzeit wieder `
      + `aufgenommen werden kann.`,
  ].join('\n\n');
}

/** Formulierung fuer eine uebersprungene Sparte. */
export function buildSkippedText(topicName: string, date: string): string {
  return `Die Sparte ${topicName} wurde im Gespräch vom ${date} nicht behandelt.`;
}

export function buildFollowUpText(
  topicName: string, date: string, customerName: string, note: string,
): string {
  const trimmed = note.trim();
  const moechte = isPlural(customerName) ? 'möchten' : 'möchte';
  return `Die Sparte ${topicName} wurde am ${date} angesprochen. ${customerName} ${moechte} das `
    + `Thema zu einem späteren Zeitpunkt vertiefen.${trimmed ? ` ${trimmed}` : ''}`;
}

/**
 * Ablehnung ohne festgehaltenen Hinweis.
 *
 * Kommt nur bei Altdaten vor - die Oberflaeche verlangt den Hinweis. Der
 * Text sagt dann, was belegt ist, und taeuscht keine Aufklaerung vor, die
 * nirgends dokumentiert ist.
 */
export function buildDeclineWithoutAdvice(
  topicName: string, date: string, customerName: string,
): string {
  const wuenscht = isPlural(customerName) ? 'wünschen' : 'wünscht';
  return `Die Sparte ${topicName} wurde am ${date} mit ${customerName} besprochen. `
    + `${customerName} ${wuenscht} zum jetzigen Zeitpunkt ausdrücklich keine weitere `
    + `Beratung und keine Offerte zu dieser Sparte.`;
}
