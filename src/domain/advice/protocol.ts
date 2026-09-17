import {
  buildDeclineText, buildDeclineWithoutAdvice, buildFollowUpText, buildSkippedText,
} from './decline-text';
import type { SummaryDocument, SummaryTopic } from './summary';

/**
 * Der Fliesstext des Protokolls (docs/08-textbausteine.md).
 *
 * Die Bausteine stehen hier und nicht im PDF-Renderer, weil derselbe Text
 * spaeter auch in der E-Mail, im Export und in der Bildschirmansicht
 * gebraucht wird. Drei Stellen, die denselben Satz leicht unterschiedlich
 * zusammensetzen, waeren genau die Art Fehler, die im Streitfall auffaellt.
 */

export function formatSwissDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('de-CH', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

export function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

/**
 * Was zu einer Sparte im Protokoll steht.
 *
 * Bei einer Ablehnung der volle Baustein - er ist der Grund, warum es das
 * Protokoll gibt. Sonst die Notiz des Beraters, unveraendert: ein System,
 * das die Worte des Beraters umformuliert, macht das Dokument angreifbar.
 */
export function topicNarrative(
  topic: SummaryTopic, document: Pick<SummaryDocument, 'date' | 'customerName'>,
): string | null {
  const date = formatSwissDate(document.date);

  if (topic.wasSkipped) return buildSkippedText(topic.name, date);

  if (topic.outcome === 'CLIENT_DECLINED') {
    // Ohne Hinweis traegt der Baustein nicht - dann steht ehrlich da, dass
    // er fehlt, statt einen Beleg vorzutaeuschen. Die Oberflaeche verlangt
    // den Hinweis; dieser Zweig faengt Altdaten ab.
    if (topic.note === null) {
      return buildDeclineWithoutAdvice(topic.name, date, document.customerName);
    }
    return buildDeclineText({
      topicName: topic.name,
      date,
      customerName: document.customerName,
      advice: topic.note,
    });
  }

  if (topic.outcome === 'FOLLOW_UP') {
    return buildFollowUpText(topic.name, date, document.customerName, topic.note ?? '');
  }

  return topic.note;
}

export const CONFIRMATION_TEXT =
  'Ich bestätige, dass die oben aufgeführten Themen mit mir besprochen wurden und dass '
  + 'meine Entscheidungen richtig wiedergegeben sind.';

export function disclaimerText(date: string): string {
  return `Dieses Protokoll gibt das Gespräch vom ${formatShortDate(date)} wieder. Es ersetzt `
    + 'keine Police und begründet keinen Versicherungsschutz.';
}
