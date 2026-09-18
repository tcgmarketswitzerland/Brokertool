/**
 * Erkennung des Dateityps am Inhalt. Framework-frei.
 *
 * Der vom Browser gemeldete Typ ist eine Behauptung des Absenders. Wer ein
 * Skript als "application/pdf" deklariert, faendet sonst eine Datei in der
 * Ablage, die spaeter jemand mit dem falschen Programm oeffnet. Geprueft
 * wird deshalb der Anfang der Datei.
 */

export type SniffedType = 'application/pdf' | 'image/jpeg' | 'image/png';

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

/** Liefert den erkannten Typ oder null, wenn die Datei keiner der drei ist. */
export function sniffType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, PDF)) return 'application/pdf';
  if (startsWith(bytes, PNG)) return 'image/png';
  if (startsWith(bytes, JPEG)) return 'image/jpeg';
  return null;
}

export const EXTENSION: Record<SniffedType, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
