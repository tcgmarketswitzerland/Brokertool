'use client';

import { useActionState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Alert, Button, Input, Select } from '@/components/ui';
import {
  CUSTOMER_TYPES, CUSTOMER_TYPE_LABEL, EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABEL,
  MARITAL_STATUSES, MARITAL_STATUS_LABEL, SEXES, SEX_LABEL,
} from '@/domain/customer/types';
import { scheduleForNew } from '@/features/advice/schedule-actions';
import type { CustomerActionState } from '@/features/customers/schemas';

const INITIAL: CustomerActionState = { status: 'idle' };

function Feld({ label, hint, error, children }: {
  label: string; hint?: string; error?: string | undefined; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[0.8125rem] font-medium">
        {label}
        {hint ? <span className="font-normal text-ink-subtle"> — {hint}</span> : null}
      </span>
      {children}
      {error ? <p role="alert" className="text-[0.8125rem] text-danger">{error}</p> : null}
    </div>
  );
}

function Gruppe({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Neuer Kunde, vollstaendig, in einem Formular.
 *
 * Pflicht sind Vor- und Nachname. Alles andere ist freiwillig, steht aber
 * bereit - wer die Angaben beim Ansetzen der Beratung ohnehin vor sich
 * hat, soll sie nicht spaeter ueber drei Formulare verteilt nachtragen
 * muessen.
 */
export function NewCustomerForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(scheduleForNew, INITIAL);
  const err = (name: string) => (state.status === 'error' ? state.fields?.[name] : undefined);

  return (
    <form action={action} className="grid gap-7">
      <Gruppe title="Person">
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label="Vorname" error={err('firstName')}>
            <Input name="firstName" required autoFocus maxLength={100} />
          </Feld>
          <Feld label="Nachname" error={err('lastName')}>
            <Input name="lastName" required maxLength={100} />
          </Feld>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Feld label="Geburtsdatum" error={err('dateOfBirth')}>
            <Input name="dateOfBirth" type="date" />
          </Feld>
          <Feld label="Geschlecht">
            <Select name="sex" defaultValue="UNSPECIFIED">
              {SEXES.map((s) => <option key={s} value={s}>{SEX_LABEL[s]}</option>)}
            </Select>
          </Feld>
          <Feld label="Zivilstand">
            <Select name="maritalStatus" defaultValue="">
              <option value="">Keine Angabe</option>
              {MARITAL_STATUSES.map((m) => (
                <option key={m} value={m}>{MARITAL_STATUS_LABEL[m]}</option>
              ))}
            </Select>
          </Feld>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label="Telefon">
            <Input name="phone" type="tel" inputMode="tel" maxLength={50} />
          </Feld>
          <Feld label="E-Mail" error={err('email')}>
            <Input name="email" type="email" />
          </Feld>
        </div>
      </Gruppe>

      <Gruppe title="Adresse">
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <Feld label="Strasse"><Input name="street" maxLength={150} /></Feld>
          <Feld label="Nummer"><Input name="streetNumber" maxLength={20} /></Feld>
        </div>
        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
          <Feld label="PLZ"><Input name="postalCode" inputMode="numeric" maxLength={10} /></Feld>
          <Feld label="Ort"><Input name="city" maxLength={100} /></Feld>
        </div>
      </Gruppe>

      <Gruppe title="Beruf und Einkommen">
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label="Beruf"><Input name="occupation" maxLength={120} /></Feld>
          <Feld label="Arbeitgeber"><Input name="employer" maxLength={120} /></Feld>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label="Anstellung">
            <Select name="employmentType" defaultValue="">
              <option value="">Keine Angabe</option>
              {EMPLOYMENT_TYPES.map((e) => (
                <option key={e} value={e}>{EMPLOYMENT_TYPE_LABEL[e]}</option>
              ))}
            </Select>
          </Feld>
          <Feld label="Jahreseinkommen" hint="brutto, in Franken" error={err('annualIncome')}>
            <Input name="annualIncome" inputMode="decimal" placeholder="95000" />
          </Feld>
        </div>
      </Gruppe>

      <Gruppe title="Kunde">
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label="Art" hint="Hausrat gehört dem Haushalt, Vorsorge einer Person">
            <Select name="customerType" defaultValue="PRIVATE">
              {CUSTOMER_TYPES.map((t) => (
                <option key={t} value={t}>{CUSTOMER_TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </Feld>
          <Feld label="Korrespondenzsprache">
            <Select name="correspondenceLanguage" defaultValue="de">
              <option value="de">Deutsch</option>
              <option value="fr">Französisch</option>
              <option value="it">Italienisch</option>
              <option value="en">Englisch</option>
            </Select>
          </Feld>
        </div>
      </Gruppe>

      {state.status === 'error' ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={pending}>
          Kunde anlegen und Beratung ansetzen
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden />Zurück zur Auswahl
        </Button>
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-ink-subtle">
        Pflicht sind nur Vor- und Nachname. Alles Weitere lässt sich auch später beim
        Kunden ergänzen — aber wenn Sie es jetzt vor sich haben, ist hier der richtige Ort.
      </p>
    </form>
  );
}
