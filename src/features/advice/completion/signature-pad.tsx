'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui';

/**
 * Unterschriftenfeld (ADR-001).
 *
 * Auf dem iPad unterschreibt der Kunde mit dem Finger, am Notebook mit der
 * Maus - deshalb Pointer-Events statt getrennter Maus- und Touch-Pfade.
 * Die Flaeche wird in Geraetepixeln gezeichnet und per CSS skaliert,
 * sonst wird der Strich auf Retina-Anzeigen unscharf.
 *
 * Das Bild verlaesst die Seite erst mit dem Abschluss. Bis dahin liegt es
 * nur im Canvas - kein Zwischenspeicher, kein LocalStorage.
 */
export function SignaturePad({ onChange, label }: {
  onChange: (dataUrl: string | null) => void;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const prepare = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1d1f';
    return ctx;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx?.scale(ratio, ratio);
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>): void {
    const ctx = prepare();
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const [x, y] = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const [x, y] = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  }

  function end(): void {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  }

  function clear(): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label={label}
          // touch-none verhindert, dass das iPad den Strich als Wischgeste
          // deutet und die Seite scrollt statt zu zeichnen.
          className="h-40 w-full touch-none rounded-lg border border-dashed border-line-strong bg-surface"
        />
        {!hasInk ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[0.8125rem] text-ink-subtle">
            Hier unterschreiben
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.8125rem] text-ink-subtle">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasInk}>
          <Eraser aria-hidden />Neu
        </Button>
      </div>
    </div>
  );
}
