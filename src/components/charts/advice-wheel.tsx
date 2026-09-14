'use client';

import { useId, useRef } from 'react';
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

const SIZE = 320;
const CENTER = SIZE / 2;
const OUTER = 150;
const INNER = 78;
const GAP = 0.014;          // Radiant zwischen den Segmenten

function polar(angle: number, radius: number): [number, number] {
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
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
  const titleId = useId();
  const refs = useRef(new Map<string, SVGGElement>());

  if (segments.length === 0) return null;
  const step = (Math.PI * 2) / segments.length;

  function move(index: number, delta: number): void {
    const next = segments[(index + delta + segments.length) % segments.length];
    if (next) refs.current.get(next.id)?.focus();
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="group"
      aria-labelledby={titleId}
      className={cn('h-auto w-full max-w-[min(80vw,360px)] select-none', className)}
    >
      <title id={titleId}>
        Beratungsrad: {settled} von {segments.length} Themen erledigt
      </title>

      {segments.map((segment, index) => {
        // Oben beginnen, im Uhrzeigersinn - so liest man ein Zifferblatt.
        const start = index * step - Math.PI / 2 + GAP / 2;
        const end = (index + 1) * step - Math.PI / 2 - GAP / 2;
        const middle = (start + end) / 2;
        const [gx, gy] = polar(middle, (OUTER + INNER) / 2);
        const active = segment.id === activeId;

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
          </g>
        );
      })}

      <circle cx={CENTER} cy={CENTER} r={INNER - 8} className="fill-[var(--color-surface)]" />
      <text
        x={CENTER} y={CENTER - 6} textAnchor="middle"
        className="fill-[var(--color-ink)] text-[30px] font-semibold [font-variant-numeric:tabular-nums]"
      >
        {settled}
        <tspan className="fill-[var(--color-ink-subtle)] text-[20px]">/{segments.length}</tspan>
      </text>
      <text
        x={CENTER} y={CENTER + 18} textAnchor="middle"
        className="fill-[var(--color-ink-muted)] text-[12px]"
      >
        Themen erledigt
      </text>
    </svg>
  );
}
