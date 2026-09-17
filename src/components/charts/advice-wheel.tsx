'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Beratungsrad.
 *
 * Handgeschriebenes SVG statt einer Chart-Bibliothek: gebraucht werden
 * Interaktion, Tastaturbedienung, doppelte Statuskodierung und
 * Screenreader-Semantik - mit Recharts waere das mehr Kampf als Nutzen
 * (Analyse 2.12).
 *
 * Das Rad ist bewusst domaenenfrei: es kennt keine Versicherungen, nur
 * Segmente mit Beschriftung, Farbe und Symbol.
 */

export type WheelSegment = {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly icon: string;
  readonly statusLabel: string;
  readonly isRequired: boolean;
};

// Der Zeichenbereich ist breiter als das Rad: die Beschriftungen stehen
// aussen. Ohne sie waere das Rad als Praesentationselement wertlos - der
// Kunde sieht sonst bunte Segmente ohne Bedeutung (Analyse 1.7).
const WIDTH = 620;
const HEIGHT = 400;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const OUTER = 148;
const INNER = 76;
const LABEL_R = OUTER + 16;
const GAP = 0.014;          // Radiant zwischen den Segmenten

function polar(angle: number, radius: number): [number, number] {
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

/**
 * Lange Spartennamen auf hoechstens zwei Zeilen umbrechen. "Vorsorge und
 * Pensionierung" passt sonst nicht in den Rand und ueberlagert das
 * Nachbarsegment.
 */
function wrap(label: string, max = 16): string[] {
  if (label.length <= max) return [label];
  // Zusammensetzungen wie "Motorfahrzeugversicherung" haben keine Luecke,
  // an der sich umbrechen liesse. Ungetrennt ragen sie aus dem
  // Zeichenbereich und werden am Rand abgeschnitten - ausgerechnet bei den
  // Sparten mit den laengsten Namen.
  const words = label.split(' ').flatMap((word) => {
    if (word.length <= max) return [word];
    const cut = Math.ceil(word.length / 2);
    return [`${word.slice(0, cut)}-`, word.slice(cut)];
  });
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= 2) return lines;
  return [lines[0]!, `${lines.slice(1).join(' ').slice(0, max - 1)}…`];
}

function segmentPath(start: number, end: number): string {
  const [x1, y1] = polar(start, OUTER);
  const [x2, y2] = polar(end, OUTER);
  const [x3, y3] = polar(end, INNER);
  const [x4, y4] = polar(start, INNER);
  const large = end - start > Math.PI ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/** Kleine Symbole als Pfade — ein Icon-Paket im SVG waere hier Ballast. */
function Glyph({ icon, x, y }: { icon: string; x: number; y: number }) {
  const common = {
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const, fill: 'none',
  };
  const shapes: Record<string, React.ReactNode> = {
    check: <path d="M-4 0.5 L-1 3.5 L4.5 -3" {...common} />,
    alert: <><path d="M0 -4.5 V1" {...common} /><circle cx="0" cy="4" r="1.1" fill="currentColor" /></>,
    slash: <><circle cx="0" cy="0" r="4.5" {...common} /><path d="M-3.2 3.2 L3.2 -3.2" {...common} /></>,
    clock: <><circle cx="0" cy="0" r="4.5" {...common} /><path d="M0 -2.4 V0.4 L2 1.8" {...common} /></>,
    minus: <path d="M-4 0 H4" {...common} />,
    'circle-dot': <><circle cx="0" cy="0" r="4.5" {...common} /><circle cx="0" cy="0" r="1.6" fill="currentColor" /></>,
    'circle-dashed': <circle cx="0" cy="0" r="4.5" {...common} strokeDasharray="2.2 2.2" />,
  };
  return <g transform={`translate(${x} ${y})`}>{shapes[icon] ?? shapes['circle-dashed']}</g>;
}

export function AdviceWheel({
  segments, settled, onSelect, activeId, className,
}: {
  segments: readonly WheelSegment[];
  settled: number;
  onSelect: (id: string) => void;
  activeId?: string | undefined;
  className?: string;
}) {
  const refs = useRef(new Map<string, SVGGElement>());

  if (segments.length === 0) return null;
  const step = (Math.PI * 2) / segments.length;

  function move(index: number, delta: number): void {
    const next = segments[(index + delta + segments.length) % segments.length];
    if (next) refs.current.get(next.id)?.focus();
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="group"
      // aria-label statt eines <title> im SVG: React 19 behandelt <title>
      // als Dokumenttitel und hebt es aus dem SVG heraus. Das Ergebnis war
      // ein Hydrationskonflikt - React verwarf den servergerenderten Baum
      // und zeichnete das Rad im Browser neu.
      aria-label={`Beratungsrad: ${settled} von ${segments.length} Themen erledigt`}
      // min-w-0: ohne das kann das Rad in einem Flex-Eltern nicht unter
      // seine Eigenbreite schrumpfen und schiebt die ganze Seite in die
      // Waagrechte - am Telefon der haeufigste Layoutfehler.
      className={cn('h-auto w-full min-w-0 max-w-[min(94vw,640px)] select-none', className)}
    >
      {segments.map((segment, index) => {
        // Oben beginnen, im Uhrzeigersinn - so liest man ein Zifferblatt.
        const start = index * step - Math.PI / 2 + GAP / 2;
        const end = (index + 1) * step - Math.PI / 2 - GAP / 2;
        const middle = (start + end) / 2;
        const [gx, gy] = polar(middle, (OUTER + INNER) / 2);
        const [lx, ly] = polar(middle, LABEL_R);
        const active = segment.id === activeId;
        // Rechts vom Mittelpunkt linksbuendig, links davon rechtsbuendig -
        // sonst laufen die Beschriftungen ins Rad hinein.
        const anchor = Math.cos(middle) > 0.08 ? 'start'
                     : Math.cos(middle) < -0.08 ? 'end' : 'middle';
        const lines = wrap(segment.label);

        return (
          <g
            key={segment.id}
            ref={(el) => { if (el) refs.current.set(segment.id, el); }}
            role="button"
            tabIndex={0}
            aria-label={`${segment.label}: ${segment.statusLabel}${segment.isRequired ? ', Pflichtthema' : ''}`}
            aria-current={active || undefined}
            onClick={() => onSelect(segment.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(segment.id);
              }
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault(); move(index, 1);
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault(); move(index, -1);
              }
            }}
            className="cursor-pointer outline-none [&:focus-visible>path]:stroke-[var(--focus-ring)] [&:focus-visible>path]:stroke-[3]"
          >
            <path
              d={segmentPath(start, end)}
              fill={segment.color}
              className={cn(
                'transition-[opacity,transform] duration-150',
                active ? 'opacity-100' : 'opacity-90 hover:opacity-100',
              )}
            />
            {/* Symbol zusaetzlich zur Farbe: siehe Analyse 1.7 */}
            <g style={{ color: 'var(--color-surface)' }} className="pointer-events-none">
              <Glyph icon={segment.icon} x={gx} y={gy} />
            </g>

            <text
              x={lx}
              y={ly - (lines.length - 1) * 6}
              textAnchor={anchor}
              dominantBaseline="middle"
              className={cn(
                'pointer-events-none text-[12.5px]',
                active ? 'fill-[var(--color-ink)] font-semibold' : 'fill-[var(--color-ink-muted)]',
              )}
            >
              {lines.map((line, i) => (
                <tspan key={line} x={lx} dy={i === 0 ? 0 : 13}>{line}</tspan>
              ))}
            </text>
          </g>
        );
      })}

      <circle cx={CX} cy={CY} r={INNER - 8} className="fill-[var(--color-surface)]" />
      <text
        x={CX} y={CY - 6} textAnchor="middle"
        className="fill-[var(--color-ink)] text-[30px] font-semibold [font-variant-numeric:tabular-nums]"
      >
        {settled}
        <tspan className="fill-[var(--color-ink-subtle)] text-[20px]">/{segments.length}</tspan>
      </text>
      <text
        x={CX} y={CY + 18} textAnchor="middle"
        className="fill-[var(--color-ink-muted)] text-[12px]"
      >
        Themen erledigt
      </text>
    </svg>
  );
}
