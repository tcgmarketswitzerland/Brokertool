'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import {
  customerSchema, fieldErrors, personSchema, quickCreateSchema,
  type CustomerActionState,
} from './schemas';

/** Legt Kunde und Hauptperson in einem Zug an. */
export async function quickCreateCustomer(
  _prev: CustomerActionState, formData: FormData,
): Promise<CustomerActionState> {
  const parsed = quickCreateSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    dateOfBirth: formData.get('dateOfBirth'),
    customerType: formData.get('customerType') ?? 'PRIVATE',
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Bitte Eingaben prüfen.', fields: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  // organization_id kommt aus dem Spalten-Default (auth_org_id()), nie aus
  // dem Formular - Regel R5.
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({ customer_type: parsed.data.customerType, created_by: auth.user.id })
    .select('id')
    .single();

  if (error || !customer) {
    logger.info('customer_create_failed', { reason: safeId(error?.code ?? 'unknown') });
    return { status: 'error', message: 'Kunde konnte nicht angelegt werden.' };
  }

  const customerId = String(customer.id);

  const { error: personError } = await supabase.from('customer_persons').insert({
    customer_id: customerId,
    person_role: 'PRIMARY',
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    date_of_birth: parsed.data.dateOfBirth ?? null,
    created_by: auth.user.id,
  });

  if (personError) {
    // Ohne Person bliebe eine namenlose Kundenzeile stehen. Aufraeumen statt
    // Leiche hinterlassen - die Kaskade entfernt sie mitsamt Abhaengigkeiten.
    await supabase.from('customers').delete().eq('id', customerId);
    logger.info('customer_person_create_failed', { reason: safeId(personError.code ?? 'unknown') });
    return { status: 'error', message: 'Kunde konnte nicht angelegt werden.' };
  }

  logger.info('customer_created', { customer: safeId(customerId) });
  revalidatePath('/kunden');
  redirect(`/kunden/${customerId}`);
}

export async function updateCustomer(
  _prev: CustomerActionState, formData: FormData,
): Promise<CustomerActionState> {
  const id = String(formData.get('customerId') ?? '');
  const parsed = customerSchema.safeParse({
    customerType: formData.get('customerType'),
    correspondenceLanguage: formData.get('correspondenceLanguage'),
    externalRef: formData.get('externalRef'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Bitte Eingaben prüfen.', fields: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('customers')
    .update({
      customer_type: parsed.data.customerType,
      correspondence_language: parsed.data.correspondenceLanguage,
      external_ref: parsed.data.externalRef ?? null,
      updated_by: auth.user?.id ?? null,
    })
    .eq('id', id);

  if (error) return { status: 'error', message: 'Änderung nicht gespeichert.' };

  revalidatePath(`/kunden/${id}`);
  return { status: 'ok', message: 'Gespeichert.' };
}

export async function savePerson(
  _prev: CustomerActionState, formData: FormData,
): Promise<CustomerActionState> {
  const customerId = String(formData.get('customerId') ?? '');
  const personId = String(formData.get('personId') ?? '');

  const parsed = personSchema.safeParse({
    personRole: formData.get('personRole'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    dateOfBirth: formData.get('dateOfBirth'),
    sex: formData.get('sex'),
    maritalStatus: formData.get('maritalStatus'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    occupation: formData.get('occupation'),
    employer: formData.get('employer'),
    employmentType: formData.get('employmentType'),
    annualIncome: formData.get('annualIncome'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Bitte Eingaben prüfen.', fields: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const row = {
    customer_id: customerId,
    person_role: parsed.data.personRole,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    date_of_birth: parsed.data.dateOfBirth ?? null,
    sex: parsed.data.sex,
    marital_status: parsed.data.maritalStatus ?? null,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    occupation: parsed.data.occupation ?? null,
    employer: parsed.data.employer ?? null,
    employment_type: parsed.data.employmentType ?? null,
    annual_income_cents: parsed.data.annualIncome ?? null,
    updated_by: auth.user?.id ?? null,
  };

  const { error } = personId
    ? await supabase.from('customer_persons').update(row).eq('id', personId)
    : await supabase.from('customer_persons').insert({ ...row, created_by: auth.user?.id ?? null });

  if (error) {
    const duplicatePrimary = error.message.includes('one_primary');
    return {
      status: 'error',
      message: duplicatePrimary
        ? 'Es gibt bereits eine Hauptperson. Wählen Sie eine andere Rolle.'
        : 'Person konnte nicht gespeichert werden.',
    };
  }

  revalidatePath(`/kunden/${customerId}`);
  return { status: 'ok', message: 'Gespeichert.' };
}

export async function removePerson(
  _prev: CustomerActionState, formData: FormData,
): Promise<CustomerActionState> {
  const customerId = String(formData.get('customerId') ?? '');
  const personId = String(formData.get('personId') ?? '');

  const supabase = await createClient();
  // Weich entfernen: an einer Person haengen spaeter Vertraege und
  // Vorsorgeanalysen, die im Protokoll nachvollziehbar bleiben muessen.
  const { error } = await supabase
    .from('customer_persons')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', personId);

  if (error) return { status: 'error', message: 'Person konnte nicht entfernt werden.' };

  revalidatePath(`/kunden/${customerId}`);
  return { status: 'ok', message: 'Person entfernt.' };
}
