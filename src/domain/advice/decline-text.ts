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

export function buildDeclineText(input: DeclineInput): string {
  const advice = input.advice.trim().replace(/\s+/g, ' ').replace(/\.$/, '');

  return [
    `Die Sparte ${input.topicName} wurde am ${input.date} mit ${input.customerName} besprochen.`,
    `${input.customerName} wurde darauf hingewiesen, dass ${advice}.`,
    `${input.customerName} wünscht zum jetzigen Zeitpunkt ausdrücklich keine weitere Beratung `
      + `und keine Offerte zu dieser Sparte. Die Entscheidung erfolgte aus eigenem Antrieb.`,
    `${input.customerName} wurde darauf hingewiesen, dass dieses Thema jederzeit wieder `
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
  return `Die Sparte ${topicName} wurde am ${date} angesprochen. ${customerName} möchte das `
    + `Thema zu einem späteren Zeitpunkt vertiefen.${trimmed ? ` ${trimmed}` : ''}`;
}
