'use client';

import { useId, useState } from 'react';
import { formatCHF, rappen } from '@/domain/shared/money';
import {
  PENSION_CASE_LABEL, PILLARS, PILLAR_LABEL, PILLAR_SHORT, type Pillar,
} from '@/domain/pension/types';
import type { CaseResult, PensionResult } from '@/domain/pension/analysis';

/**
 * Die Vorsorgegrafik.
 *
 * Liegende Balken, weil die Fallbezeichnungen lange deutsche Woerter sind
 * ("Erwerbsunfaehigkeit durch Krankheit") - stehend muessten sie gekippt
 * oder abgeschnitten werden. Gestapelt nach Saeule, weil der Kunde sehen
 * soll, woher sein Einkommen im Ernstfall kaeme, nicht nur wie viel.
 *
 * Die Ziellinie ist das eigentliche Argument: die Luecke ist das, was
 * rechts davon fehlt. Ohne sie waeren es vier Balken ohne Aussage.
 */

const PILLAR_COLOR: Record<Pillar, string> = {
  PILLAR_1: 'var(--pillar-1)',
  UVG: 'var(--pillar-uvg)',
  PILLAR_2: 'var(--pillar-2)',
  PILLAR_3: 'var(--pillar-3)',
  OTHER: 'var(--pillar-other)',
};

const ROW = 64;
const BAR = 26;
const LABEL_W = 132;
const RIGHT = 8;
const WIDTH = 640;

function Bar({
  result, y, scale, target,
}: {
  result: CaseResult;
  y: number;
  scale: number;
  target: number | null;
}) {
  // Vorab aufsummieren statt waehrend des Renderns fortzuschreiben: eine
  // Variable, die der Renderdurchlauf veraendert, verhaelt sich beim
  // naechsten Durchlauf anders.
  const offsets: number[] = [];
  let running = LABEL_W;
  for (const part of result.byPillar) {
    offsets.push(running);
    running += Math.max(0, part.annualCents * scale);
  }
  const end = running;

  return (
    <g>
      <text x={LABEL_W - 10} y={y + BAR / 2} textAnchor="end" dominantBaseline="middle"
            className="fill-[var(--color-ink)] text-[12px] font-medium">
        {PENSION_CASE_LABEL[result.pensionCase].replace('Erwerbsunfähigkeit durch ', '')}
      </text>

      {result.totalCents === 0 ? (
        <text x={LABEL_W + 4} y={y + BAR / 2} dominantBaseline="middle"
              className="fill-[var(--color-ink-subtle)] text-[12px]">
          nichts erfasst
        </text>
      ) : null}

      {result.byPillar.map((part, index) => {
        const w = Math.max(0, part.annualCents * scale);
        const left = offsets[index] ?? LABEL_W;
        const last = index === result.byPillar.length - 1;
        // 2px Luecke zwischen den Abschnitten und runde Enden nur aussen:
        // so bleibt der Stapel als ein Balken lesbar.
        return (
          <rect
            key={part.pillar}
            x={left}
            y={y}
            width={Math.max(0, w - (last ? 0 : 2))}
            height={BAR}
            rx={4}
            fill={PILLAR_COLOR[part.pillar]}
          />
        );
      })}

      {/* Heller Rand hinter der Schrift: der Betrag landet genau dann auf
          der Ziellinie, wenn er das Ziel fast erreicht - also im
          interessantesten Fall. */}
      {result.totalCents > 0 ? (
        <text x={end + 8} y={y + BAR / 2} dominantBaseline="middle"
              stroke="var(--color-bg)" strokeWidth={3} paintOrder="stroke"
              className="fill-[var(--color-ink)] text-[12px] font-medium tabular-nums">
          {formatCHF(rappen(result.totalCents))}
          {result.coveragePercent !== null ? (
            <tspan className="fill-[var(--color-ink-muted)] font-normal">
              {' '}· {result.coveragePercent}%
            </tspan>
          ) : null}
        </text>
      ) : null}

      {target !== null && result.gapCents !== null && result.gapCents > 0 ? (
        <text x={LABEL_W} y={y + BAR + 15}
              className="fill-[var(--color-danger)] text-[11px] tabular-nums">
          Lücke {formatCHF(rappen(result.gapCents))}
        </text>
      ) : null}
    </g>
  );
}

export function PensionChart({ result }: { result: PensionResult }) {
  const titleId = useId();
  const [showTable, setShowTable] = useState(false);

  const maxValue = Math.max(
    result.targetCents ?? 0,
    ...result.cases.map((c) => c.totalCents),
    1,
  );
  const plotWidth = WIDTH - LABEL_W - RIGHT - 120;
  const scale = plotWidth / maxValue;
  const height = result.cases.length * ROW + 24;

  const usedPillars = PILLARS.filter((p) =>
    result.cases.some((c) => c.byPillar.some((b) => b.pillar === p)));

  return (
    <div className="grid gap-3">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-labelledby={titleId}
           className="h-auto w-full min-w-0">
        <desc id={titleId}>
          Jahreseinkommen in vier Fällen, gestapelt nach Säule, im Vergleich zum Ziel.
        </desc>

        {result.targetCents !== null ? (
          <>
            <line
              x1={LABEL_W + result.targetCents * scale}
              x2={LABEL_W + result.targetCents * scale}
              y1={0} y2={height - 20}
              className="stroke-[var(--color-ink-subtle)]"
              strokeWidth={2} strokeDasharray="4 4"
            />
            <text x={LABEL_W + result.targetCents * scale} y={height - 6} textAnchor="middle"
                  className="fill-[var(--color-ink-muted)] text-[11px] tabular-nums">
              Ziel {formatCHF(rappen(result.targetCents))}
            </text>
          </>
        ) : null}

        {result.cases.map((c, i) => (
          <Bar key={c.pensionCase} result={c} y={i * ROW + 6} scale={scale}
               target={result.targetCents} />
        ))}
      </svg>

      {usedPillars.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {usedPillars.map((p) => (
            <li key={p} className="flex items-center gap-1.5 text-[0.8125rem] text-ink-muted">
              <span aria-hidden className="size-2.5 rounded-[2px]"
                    style={{ backgroundColor: PILLAR_COLOR[p] }} />
              {PILLAR_LABEL[p]}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Die Tabelle ist kein Beiwerk: wer die Farben nicht unterscheiden
          kann oder das Blatt ausdruckt, liest hier dieselben Zahlen. */}
      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          className="w-fit rounded-sm text-[0.8125rem] font-medium text-accent hover:underline"
        >
          {showTable ? 'Zahlen ausblenden' : 'Zahlen als Tabelle'}
        </button>

        {showTable ? (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-[0.8125rem]">
              <thead className="border-b border-line bg-surface-sunken text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Fall</th>
                  {usedPillars.map((p) => (
                    <th key={p} className="px-3 py-2 text-right font-medium">
                      {PILLAR_SHORT[p]}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Lücke</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {result.cases.map((c) => (
                  <tr key={c.pensionCase}>
                    <td className="px-3 py-2">{PENSION_CASE_LABEL[c.pensionCase]}</td>
                    {usedPillars.map((p) => {
                      const amount = c.byPillar.find((b) => b.pillar === p)?.annualCents ?? 0;
                      return (
                        <td key={p} className="px-3 py-2 text-right text-ink-muted">
                          {amount > 0 ? formatCHF(rappen(amount)) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCHF(rappen(c.totalCents))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.gapCents === null ? '—'
                        : c.gapCents > 0
                          ? <span className="text-danger">{formatCHF(rappen(c.gapCents))}</span>
                          : <span className="text-success">keine</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
