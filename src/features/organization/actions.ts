'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { sniffType } from '@/domain/document/sniff';
import {
  brandingSchema, companySchema, type OrganizationActionState,
} from './schemas';

/** Rund 1 MB Rohdaten; als base64 bleibt das unter der Pruefung in 0025. */
const MAX_LOGO_BYTES = 1_000_000;

function fieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Welche Zeile geaendert wird, entscheidet RLS: die Update-Policy auf
 * `organizations` laesst nur die eigene Firma durch, und nur fuer Owner
 * und Admin. Ein `eq('id', ...)` aus dem Formular waere nicht nur
 * ueberfluessig, sondern eine zweite Wahrheit ueber die Zugehoerigkeit.
 */
async function updateOrganization(
  values: Record<string, unknown>,
): Promise<OrganizationActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: 'error', message: 'Nicht angemeldet.' };

  const { error, count } = await supabase
    .from('organizations')
    .update(values, { count: 'exact' })
    .is('deleted_at', null);

  if (error) {
    logger.info('organization_update_failed', { reason: safeId(error.code ?? 'unknown') });
    return { status: 'error', message: 'Die Angaben konnten nicht gespeichert werden.' };
  }
  if (count === 0) {
    return { status: 'error', message: 'Dafür fehlt Ihnen die Berechtigung.' };
  }

  revalidatePath('/einstellungen', 'layout');
  return { status: 'ok', message: 'Gespeichert.' };
}

export async function saveCompanyProfile(
  _prev: OrganizationActionState, formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = companySchema.safeParse({
    name: formData.get('name'),
    street: formData.get('street'),
    postalCode: formData.get('postalCode'),
    city: formData.get('city'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    website: formData.get('website'),
    requireMfa: formData.get('requireMfa') ?? '',
  });

  if (!parsed.success) {
    return {
      status: 'error', message: 'Bitte Eingaben prüfen.',
      fields: fieldErrors(parsed.error.issues),
    };
  }
  const v = parsed.data;

  return updateOrganization({
    name: v.name,
    street: v.street,
    postal_code: v.postalCode,
    city: v.city,
    phone: v.phone,
    email: v.email,
    website: v.website,
    require_mfa: v.requireMfa,
  });
}

export async function saveBranding(
  _prev: OrganizationActionState, formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = brandingSchema.safeParse({ brandColor: formData.get('brandColor') });
  if (!parsed.success) {
    return {
      status: 'error', message: 'Bitte Eingaben prüfen.',
      fields: fieldErrors(parsed.error.issues),
    };
  }

  const values: Record<string, unknown> = { brand_color: parsed.data.brandColor };
  const file = formData.get('logo');

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) {
      return {
        status: 'error', message: 'Bitte Eingaben prüfen.',
        fields: { logo: 'Das Logo ist grösser als 1 MB.' },
      };
    }

    // Der gemeldete Typ ist eine Behauptung des Absenders; geprueft werden
    // die ersten Bytes (ADR-010).
    const buffer = await file.arrayBuffer();
    const sniffed = sniffType(new Uint8Array(buffer.slice(0, 16)));
    if (sniffed !== 'image/png' && sniffed !== 'image/jpeg') {
      return {
        status: 'error', message: 'Bitte Eingaben prüfen.',
        fields: { logo: 'Nur PNG oder JPEG.' },
      };
    }

    values.logo_base64 = Buffer.from(buffer).toString('base64');
    values.logo_content_type = sniffed;
  }

  return updateOrganization(values);
}

export async function removeLogo(
  _prev: OrganizationActionState, _formData: FormData,
): Promise<OrganizationActionState> {
  return updateOrganization({ logo_base64: null, logo_content_type: null });
}
