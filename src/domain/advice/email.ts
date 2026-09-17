import { formatShortDate, formatSwissDate } from './protocol';
import type { Outcome } from './status';
import type { SummaryDocument } from './summary';

/**
 * Die Abschluss-E-Mail (docs/08-textbausteine.md, Abschnitt 3).
 *
 * Bewusst ohne die abgelehnten Themen: sie stehen im Protokoll, wo sie
 * hingehoeren. In der E-Mail zu wiederholen liest sich wie Nachfassen und
 * beschaedigt das Vertrauen, das im Gespraech entstanden ist.
 */

const ACTION_OUTCOMES: ReadonlySet<Outcome> = new Set<Outcome>([
  'ACTION_REQUIRED', 'OFFER_REQUESTED', 'CONTRACT_REQUESTED', 'FOLLOW_UP',
]);

export type EmailDraft = { subject: string; body: string };

function bullets(items: readonly { title: string; dueDate: string | null }[]): string {
  return items
    .map((t) => `  • ${t.title}${t.dueDate ? ` (bis ${formatShortDate(t.dueDate)})` : ''}`)
    .join('\n');
}

export function buildEmailDraft(document: SummaryDocument, salutation?: string): EmailDraft {
  const sections: string[] = [];

  sections.push(salutation ?? `Guten Tag ${document.customerName}`);
  sections.push(
    'Vielen Dank für das Gespräch. Anbei finden Sie das Protokoll mit allen besprochenen Themen.');

  const highlights = document.topics.filter(
    (t) => t.outcome !== null && ACTION_OUTCOMES.has(t.outcome));

  if (highlights.length > 0) {
    sections.push(
      'Kurz zusammengefasst:\n'
      + highlights.map((t) => `  • ${t.name} — ${t.outcomeLabel.toLowerCase()}`).join('\n'));
  }

  // Zuerst die Aufgaben des Kunden: er will zuerst wissen, was von ihm
  // erwartet wird. Danach die eigenen - das zeigt, dass sich auch der
  // Berater etwas vorgenommen hat.
  if (document.customerTasks.length > 0) {
    sections.push(`Ihre offenen Punkte:\n${bullets(document.customerTasks)}`);
  }
  if (document.advisorTasks.length > 0) {
    sections.push(`Meine offenen Punkte:\n${bullets(document.advisorTasks)}`);
  }

  sections.push('Bei Fragen melden Sie sich jederzeit.');
  sections.push(
    `Freundliche Grüsse\n${document.advisorName}${
      document.organizationName ? `\n${document.organizationName}` : ''}`);

  return {
    subject: `Unser Gespräch vom ${formatSwissDate(document.date)}`,
    body: sections.join('\n\n'),
  };
}
