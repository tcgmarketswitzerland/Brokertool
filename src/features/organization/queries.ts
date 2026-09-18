import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type OrganizationProfile = {
  id: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  finmaNumber: string | null;
  brandColor: string | null;
  /** Vollstaendiger data:-Verweis oder null. Nur fuer Anzeige und PDF. */
  logoDataUrl: string | null;
  requireMfa: boolean;
};

/**
 * Die eigene Firma.
 *
 * Ohne Filter auf die id: RLS gibt genau eine Zeile heraus, die eigene.
 * Ein zusaetzlicher Filter waere Sicherheitstheater und verschwiege, dass
 * die Trennung an der Datenbank haengt.
 */
export async function getOrganization(): Promise<OrganizationProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select(`id, name, street, postal_code, city, phone, email, website, finma_number,
             brand_color, logo_base64, logo_content_type, require_mfa`)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const text = (value: unknown) => (value == null ? null : String(value));

  return {
    id: String(data.id),
    name: String(data.name),
    street: text(data.street),
    postalCode: text(data.postal_code),
    city: text(data.city),
    phone: text(data.phone),
    email: text(data.email),
    website: text(data.website),
    finmaNumber: text(data.finma_number),
    brandColor: text(data.brand_color),
    logoDataUrl: data.logo_base64 == null || data.logo_content_type == null
      ? null
      : `data:${String(data.logo_content_type)};base64,${String(data.logo_base64)}`,
    requireMfa: data.require_mfa === true,
  };
}

/** Die Firmenangaben, wie sie ins Protokoll eingefroren werden. */
export type OrganizationContact = {
  readonly name: string;
  readonly street: string | null;
  readonly postalCode: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly website: string | null;
  readonly finmaNumber: string | null;
};

export async function getOrganizationContact(): Promise<OrganizationContact> {
  const organization = await getOrganization();
  if (!organization) {
    return { name: '', street: null, postalCode: null, city: null,
             phone: null, email: null, website: null, finmaNumber: null };
  }
  return {
    name: organization.name,
    street: organization.street,
    postalCode: organization.postalCode,
    city: organization.city,
    phone: organization.phone,
    email: organization.email,
    website: organization.website,
    finmaNumber: organization.finmaNumber,
  };
}
