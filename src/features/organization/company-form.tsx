'use client';

import { useActionState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { saveCompanyProfile } from './actions';
import type { OrganizationActionState } from './schemas';
import type { OrganizationProfile } from './queries';

const INITIAL: OrganizationActionState = { status: 'idle' };

/**
 * Firmenangaben.
 *
 * Diese Zeilen stehen spaeter auf jedem Beratungsprotokoll. Sie werden
 * beim Abschluss in den Snapshot eingefroren: ein Nachdruck in fuenf
 * Jahren zeigt die Adresse vom Gespraechstag, nicht die von heute.
 */
export function CompanyForm({ organization }: { organization: OrganizationProfile }) {
  const [state, action, pending] = useActionState(saveCompanyProfile, INITIAL);
  const err = (name: string) => (state.status === 'error' ? state.fields?.[name] : undefined);

  return (
    <form action={action} className="grid gap-5">
      <Field label="Firmenname" required error={err('name')}>
        {(props) => (
          <Input {...props} name="name" defaultValue={organization.name} required
                 autoComplete="organization" maxLength={200} />
        )}
      </Field>

      <Field label="Strasse und Nummer" error={err('street')}>
        {(props) => (
          <Input {...props} name="street" defaultValue={organization.street ?? ''}
                 autoComplete="street-address" placeholder="Bahnhofstrasse 1" />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
        <Field label="PLZ" error={err('postalCode')}>
          {(props) => (
            <Input {...props} name="postalCode" defaultValue={organization.postalCode ?? ''}
                   inputMode="numeric" maxLength={4} className="tabular" placeholder="8001" />
          )}
        </Field>
        <Field label="Ort" error={err('city')}>
          {(props) => (
            <Input {...props} name="city" defaultValue={organization.city ?? ''}
                   autoComplete="address-level2" placeholder="Zürich" />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefon" error={err('phone')}>
          {(props) => (
            <Input {...props} name="phone" type="tel" defaultValue={organization.phone ?? ''}
                   autoComplete="tel" placeholder="044 123 45 67" />
          )}
        </Field>
        <Field label="E-Mail" error={err('email')}>
          {(props) => (
            <Input {...props} name="email" type="email" defaultValue={organization.email ?? ''}
                   autoComplete="email" placeholder="beratung@ihrefirma.ch" />
          )}
        </Field>
      </div>

      <Field label="Website" hint="ohne https:// genügt" error={err('website')}>
        {(props) => (
          <Input {...props} name="website" defaultValue={organization.website ?? ''}
                 placeholder="ihrefirma.ch" />
        )}
      </Field>

      <Field label="FINMA-Nr. der Firma" hint="Registernummer im Vermittlerregister"
             error={err('finmaNumber')}>
        {(props) => (
          <Input {...props} name="finmaNumber" defaultValue={organization.finmaNumber ?? ''}
                 className="tabular" maxLength={60} placeholder="F01234567" />
        )}
      </Field>

      <label className="flex items-start gap-3 rounded-lg border border-line bg-surface-sunken px-4 py-3">
        <input
          type="checkbox" name="requireMfa" defaultChecked={organization.requireMfa}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span>
          <span className="block text-[0.875rem] font-medium">
            Zwei-Faktor-Anmeldung für alle verlangen
          </span>
          <span className="block text-[0.8125rem] leading-relaxed text-ink-muted">
            Ohne zweiten Faktor kommt niemand mehr an Kundendaten. Richten Sie ihn zuerst für
            sich selbst ein — sonst sperren Sie sich aus.
          </span>
        </span>
      </label>

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
  );
}
