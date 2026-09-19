'use client';

import { useActionState } from 'react';
import { FlaskConical, Trash2 } from 'lucide-react';
import { Alert, Button, Card, CardContent } from '@/components/ui';
import { createDemoData, removeDemoData, type DemoState } from './actions';

const INITIAL: DemoState = { status: 'idle' };

/**
 * Demodaten anbieten oder wieder wegraeumen.
 *
 * Eine leere Anwendung laesst sich nicht beurteilen: vier Nullen und eine
 * leere Liste sagen nichts darueber, ob das Werkzeug taugt. Sobald es
 * echte Kunden gibt, verschwindet das Angebot - dann waere es nur noch
 * eine Gelegenheit, sich erfundene Kunden in die Liste zu holen.
 */
export function DemoPanel({ hasDemo, hasCustomers }: {
  hasDemo: boolean;
  hasCustomers: boolean;
}) {
  const [createState, create, creating] = useActionState(createDemoData, INITIAL);
  const [removeState, remove, removing] = useActionState(removeDemoData, INITIAL);

  if (hasDemo) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/25 bg-warning-soft px-4 py-3">
        <FlaskConical aria-hidden className="size-4 shrink-0 text-warning" />
        <p className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed text-warning">
          <span className="font-medium">Sie sehen Demodaten.</span>{' '}
          Erfundene Kunden, Verträge und Beratungen zum Ausprobieren — sie zählen in jeder
          Übersicht mit.
        </p>
        <form action={remove}>
          <Button type="submit" variant="ghost" size="sm" loading={removing}>
            <Trash2 aria-hidden />Entfernen
          </Button>
        </form>
        {removeState.status === 'error' ? (
          <p role="alert" className="w-full text-[0.8125rem] text-danger">
            {removeState.message}
          </p>
        ) : null}
      </div>
    );
  }

  if (hasCustomers) return null;

  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-muted">
            <FlaskConical aria-hidden className="size-4" />
          </span>
          <div className="grid gap-1">
            <p className="font-medium">Erst einmal ansehen?</p>
            <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
              Drei erfundene Haushalte mit Verträgen, einer abgeschlossenen Beratung samt
              Protokoll und einer laufenden. Auf Knopfdruck wieder weg.
            </p>
          </div>
        </div>

        {createState.status === 'error' ? (
          <Alert tone="danger">{createState.message}</Alert>
        ) : null}

        <form action={create}>
          <Button type="submit" variant="secondary" loading={creating}>
            Demodaten anlegen
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
