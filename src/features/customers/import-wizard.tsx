'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Select } from '@/components/ui';
import {
  guessMapping, IMPORT_FIELDS, IMPORT_FIELD_LABEL, mapRows, parseCsv,
  type CsvTable, type ImportField, type ParsedRow,
} from '@/domain/customer/csv';
import { importCustomers, type ImportResult } from './import-actions';

const INITIAL: ImportResult = { status: 'idle' };
const PREVIEW = 8;

export function ImportWizard() {
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(importCustomers, INITIAL);

  const rows: ParsedRow[] = useMemo(
    () => (table ? mapRows(table, mapping) : []),
    [table, mapping],
  );
  const valid = rows.filter((r) => !r.error);
  const invalid = rows.filter((r) => r.error);

  async function onFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (file.size > 5_000_000) {
      setFileError('Die Datei ist grösser als 5 MB. Bitte in kleinere Teile aufteilen.');
      return;
    }

    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.headers.length === 0) {
      setFileError('In der Datei wurde keine Kopfzeile gefunden.');
      return;
    }
    setTable(parsed);
    setMapping(guessMapping(parsed.headers));
  }

  function setField(field: ImportField, value: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (value === '') delete next[field];
      else next[field] = Number(value);
      return next;
    });
  }

  if (state.status === 'ok') {
    return (
      <Card>
        <CardContent className="grid gap-4 py-8">
          <div className="grid gap-1.5 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
              <Check aria-hidden className="size-5" strokeWidth={2.5} />
            </span>
            <p className="text-lg font-medium">
              {state.imported} {state.imported === 1 ? 'Kunde' : 'Kunden'} importiert
            </p>
            {state.failed.length > 0 ? (
              <p className="text-[0.8125rem] text-ink-muted">
                {state.failed.length} {state.failed.length === 1 ? 'Zeile' : 'Zeilen'} übersprungen.
              </p>
            ) : null}
          </div>

          {state.failed.length > 0 ? (
            <Alert tone="warning" title="Übersprungene Zeilen">
              <ul className="mt-1 grid gap-0.5">
                {state.failed.slice(0, 20).map((f) => (
                  <li key={f.line}>Zeile {f.line}: {f.reason}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <Button asChild className="mx-auto"><Link href="/kunden">Zur Kundenliste</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader><CardTitle>1. Datei wählen</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-surface-hover">
            <Upload aria-hidden className="size-4" />
            {table ? 'Andere Datei wählen' : 'CSV auswählen'}
            <input type="file" accept=".csv,text/csv,text/plain" className="sr-only"
                   onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          <p className="text-[0.8125rem] leading-relaxed text-ink-subtle">
            Export aus Ihrem Maklersystem oder aus Excel. Semikolon, Komma und Tabulator werden
            erkannt, ebenso Umlaute und Zeilenumbrüche in Feldern.
          </p>
          {fileError ? <Alert tone="danger">{fileError}</Alert> : null}
          {table ? (
            <p className="text-[0.8125rem] text-ink-muted">
              {table.rows.length} {table.rows.length === 1 ? 'Zeile' : 'Zeilen'} gelesen,
              Trennzeichen <code className="rounded bg-surface-sunken px-1">
                {table.delimiter === '\t' ? 'Tabulator' : table.delimiter}
              </code>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {table ? (
        <>
          <Card>
            <CardHeader><CardTitle>2. Spalten zuordnen</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
                <div key={field} className="grid gap-1.5">
                  <label htmlFor={`map-${field}`} className="text-[0.8125rem] font-medium">
                    {IMPORT_FIELD_LABEL[field]}
                    {field === 'firstName' || field === 'lastName' ? (
                      <span className="ml-0.5 text-danger" aria-hidden>*</span>
                    ) : null}
                  </label>
                  <Select id={`map-${field}`} value={mapping[field] ?? ''}
                          onChange={(e) => setField(field, e.target.value)}>
                    <option value="">— nicht importieren —</option>
                    {table.headers.map((h, i) => (
                      <option key={`${h}-${i}`} value={i}>{h || `Spalte ${i + 1}`}</option>
                    ))}
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Prüfen</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">{valid.length} werden importiert</Badge>
                {invalid.length > 0 ? (
                  <Badge tone="warning">
                    <AlertTriangle aria-hidden />{invalid.length} übersprungen
                  </Badge>
                ) : null}
              </div>

              {invalid.length > 0 ? (
                <Alert tone="warning" title="Diese Zeilen werden nicht importiert">
                  <ul className="mt-1 grid gap-0.5">
                    {invalid.slice(0, 10).map((r) => (
                      <li key={r.line}>Zeile {r.line}: {r.error}</li>
                    ))}
                    {invalid.length > 10 ? <li>… und {invalid.length - 10} weitere</li> : null}
                  </ul>
                </Alert>
              ) : null}

              {valid.length > 0 ? (
                <div className="overflow-x-auto rounded-md border border-line">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-sunken text-left">
                      <tr>
                        {IMPORT_FIELDS.filter((f) => mapping[f] !== undefined).map((f) => (
                          <th key={f} className="whitespace-nowrap px-3 py-2 font-medium">
                            {IMPORT_FIELD_LABEL[f]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {valid.slice(0, PREVIEW).map((r) => (
                        <tr key={r.line}>
                          {IMPORT_FIELDS.filter((f) => mapping[f] !== undefined).map((f) => (
                            <td key={f} className="whitespace-nowrap px-3 py-2 text-ink-muted">
                              {r.values[f] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {valid.length > PREVIEW ? (
                    <p className="border-t border-line px-3 py-2 text-[0.8125rem] text-ink-subtle">
                      … und {valid.length - PREVIEW} weitere
                    </p>
                  ) : null}
                </div>
              ) : null}

              {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

              <form action={action}>
                <input type="hidden" name="rows" value={JSON.stringify(valid)} />
                <Button type="submit" size="lg" loading={pending} disabled={valid.length === 0}>
                  {valid.length} {valid.length === 1 ? 'Kunde' : 'Kunden'} importieren
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
