import { describe, expect, it } from 'vitest';
import { EXTENSION, sniffType } from '@/domain/document/sniff';

const bytes = (...values: number[]) => Uint8Array.from(values);

describe('sniffType', () => {
  it('erkennt ein PDF an der Signatur', () => {
    expect(sniffType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37))).toBe('application/pdf');
  });

  it('erkennt PNG und JPEG', () => {
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe('image/png');
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe('image/jpeg');
  });

  // Der gemeldete Typ zaehlt nicht: hier steht ein Skript drin, das sich
  // als PDF ausgibt. Genau das soll die Pruefung abfangen.
  it('weist eine Datei ab, die nur so heisst', () => {
    const script = new TextEncoder().encode('#!/bin/sh\necho hallo\n');
    expect(sniffType(script)).toBeNull();
  });

  it('weist eine zu kurze Datei ab, statt daneben zu lesen', () => {
    expect(sniffType(bytes(0x25, 0x50))).toBeNull();
    expect(sniffType(bytes())).toBeNull();
  });

  it('gibt zu jedem erkannten Typ eine Endung', () => {
    expect(EXTENSION['application/pdf']).toBe('pdf');
    expect(EXTENSION['image/jpeg']).toBe('jpg');
    expect(EXTENSION['image/png']).toBe('png');
  });
});
