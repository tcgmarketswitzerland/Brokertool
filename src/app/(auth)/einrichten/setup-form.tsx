'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { createOrganization, refreshSession } from '@/features/auth/setup-actions';
import type { AuthState } from '@/features/auth/schemas';

const INITIAL: AuthState = { status: 'idle' };

function Feld({ label, hint, htmlFor, children }: {
  label: string; hint?: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[0.8125rem] font-medium">
        {label}
        {hint ? <span className="font-normal text-ink-subtle"> — {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

/**
 * Die Brokerfirma eroeffnen.
 *
 * Alles hier ist Pflicht. Die Angaben stehen spaeter auf jedem
 * Beratungsprotokoll - und nachgetragen wird erfahrungsgemaess nie.
 */
export function SetupForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(createOrganization, INITIAL);

  return (
    <form action={action} className="grid gap-4">
      <Feld label="Brokerfirma" htmlFor="organizationName">
        <Input id="organizationName" name="organizationName" required autoFocus
               maxLength={200} autoComplete="organization" placeholder="Muster Broker AG" />
      </Feld>

      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Kontakt-E-Mail" htmlFor="email">
          <Input id="email" name="email" type="email" required
                 placeholder="beratung@musterbroker.ch" />
        </Feld>
        <Feld label="Telefon" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" required maxLength={40}
                 placeholder="044 123 45 67" />
        </Feld>
      </div>

      <Feld label="Strasse und Nummer" htmlFor="street">
        <Input id="street" name="street" required maxLength={150}
               autoComplete="street-address" placeholder="Bahnhofstrasse 1" />
      </Feld>

      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Feld label="PLZ" htmlFor="postalCode">
          <Input id="postalCode" name="postalCode" required inputMode="numeric"
                 maxLength={4} className="tabular" placeholder="8001" />
        </Feld>
        <Feld label="Ort" htmlFor="city">
          <Input id="city" name="city" required maxLength={100}
                 autoComplete="address-level2" placeholder="Zürich" />
        </Feld>
      </div>

      <Feld label="FINMA-Nr. der Firma" hint="Registernummer im FINMA-Vermittlerregister"
            htmlFor="finmaNumber">
        <Input id="finmaNumber" name="finmaNumber" required maxLength={60}
               className="tabular" placeholder="F01234567" />
      </Feld>

      <Feld label="Ihr Name" hint="Sie führen den Adminaccount" htmlFor="fullName">
        <Input id="fullName" name="fullName" required maxLength={200}
               defaultValue={defaultName} placeholder="Peter Muster" />
      </Feld>

      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

      <Button type="submit" loading={pending}>Firma anlegen</Button>
    </form>
  );
}

export function RefreshForm() {
  return (
    <form action={refreshSession}>
      <Button type="submit" className="w-full">Sitzung erneuern</Button>
    </form>
  );
}
