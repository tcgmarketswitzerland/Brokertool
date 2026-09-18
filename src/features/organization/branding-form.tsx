'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { Trash2, Upload } from 'lucide-react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { removeLogo, saveBranding } from './actions';
import type { OrganizationActionState } from './schemas';
import type { OrganizationProfile } from './queries';

const INITIAL: OrganizationActionState = { status: 'idle' };

/** Der Vorgabewert, wenn keine Hausfarbe gesetzt ist. */
const DEFAULT_COLOR = '#0f766e';

/**
 * Logo und Hausfarbe fuers Protokoll.
 *
 * Bewusst nur zwei Einstellungen. Ein Protokoll ist im Streitfall ein
 * Beweismittel und wird danach beurteilt, nicht nach seiner Gestaltung -
 * mehr Regler waeren mehr Gelegenheiten, es unleserlich zu machen.
 */
export function BrandingForm({ organization }: { organization: OrganizationProfile }) {
  const [state, action, pending] = useActionState(saveBranding, INITIAL);
  const [removeState, removeAction, removing] = useActionState(removeLogo, INITIAL);
  const [color, setColor] = useState(organization.brandColor ?? DEFAULT_COLOR);
  const [chosen, setChosen] = useState<string | null>(null);

  const err = (name: string) => (state.status === 'error' ? state.fields?.[name] : undefined);
  const preview = chosen ?? organization.logoDataUrl;

  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-5">
        <div className="grid gap-2">
          <p className="text-[0.8125rem] font-medium">Logo</p>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-44 items-center justify-center rounded-lg border border-line bg-surface p-2">
              {preview ? (
                // Kein next/image-Optimierer: das Bild ist ein data:-Verweis
                // aus der eigenen Datenbank und hat keine Quell-URL.
                <Image src={preview} alt="Logo der Firma" width={160} height={64}
                       unoptimized className="max-h-16 w-auto object-contain" />
              ) : (
                <span className="text-[0.8125rem] text-ink-subtle">Noch kein Logo</span>
              )}
            </div>

            <div className="grid gap-1.5">
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-[0.8125rem] font-medium transition-colors hover:bg-surface-hover">
                <Upload aria-hidden className="size-3.5 text-ink-subtle" />
                Datei wählen
                <input
                  type="file" name="logo" accept="image/png,image/jpeg" className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setChosen(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </label>
              <span className="text-[0.75rem] text-ink-subtle">PNG oder JPEG, bis 1 MB</span>
              {err('logo') ? (
                <span role="alert" className="text-[0.8125rem] text-danger">{err('logo')}</span>
              ) : null}
            </div>
          </div>
        </div>

        <Field label="Hausfarbe" hint="für Linien und Überschriften im Protokoll"
               error={err('brandColor')}>
          {(props) => (
            <div className="flex items-center gap-2">
              <input
                type="color" value={color} aria-label="Farbe wählen"
                onChange={(e) => setColor(e.target.value)}
                className="size-10 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-1"
              />
              <Input {...props} name="brandColor" value={color} className="tabular w-36"
                     onChange={(e) => setColor(e.target.value)} maxLength={7} />
            </div>
          )}
        </Field>

        {state.status === 'error' && !state.fields ? (
          <Alert tone="danger">{state.message}</Alert>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={pending}>Speichern</Button>
          {state.status === 'ok' ? (
            <span className="text-[0.8125rem] text-success">{state.message}</span>
          ) : null}
        </div>
      </form>

      {organization.logoDataUrl ? (
        <form action={removeAction} className="border-t border-line pt-4">
          <Button type="submit" variant="ghost" size="sm" loading={removing}>
            <Trash2 aria-hidden />Logo entfernen
          </Button>
          {removeState.status === 'error' ? (
            <p role="alert" className="mt-2 text-[0.8125rem] text-danger">{removeState.message}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
