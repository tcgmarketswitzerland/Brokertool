import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  CustomerType, EmploymentType, Language, MaritalStatus, PersonRole, Sex,
} from '@/domain/customer/types';

export type CustomerListItem = {
  id: string;
  displayName: string;
  customerType: CustomerType;
  updatedAt: string;
  personCount: number;
};

export type Person = {
  id: string;
  personRole: PersonRole;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  sex: Sex;
  maritalStatus: MaritalStatus | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  employer: string | null;
  employmentType: EmploymentType | null;
  annualIncomeCents: number | null;
};

export type CustomerDetail = {
  id: string;
  displayName: string;
  customerType: CustomerType;
  correspondenceLanguage: Language;
  externalRef: string | null;
  persons: Person[];
};

const str = (v: unknown): string => String(v ?? '');
const nullable = (v: unknown): string | null => (v == null ? null : String(v));

/**
 * Suche ueber Anzeigenamen und Personennamen. RLS begrenzt bereits auf die
 * eigene Organisation - ein zusaetzlicher Filter waere Sicherheitstheater
 * und wuerde verdecken, worauf die Absicherung tatsaechlich beruht.
 */
export async function listCustomers(search?: string): Promise<CustomerListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from('customers')
    .select('id, display_name, customer_type, updated_at, customer_persons(count)')
    .is('deleted_at', null)
    .order('display_name')
    .limit(200);

  const term = search?.trim();
  if (term) query = query.ilike('display_name', `%${term}%`);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const counts = row.customer_persons as unknown;
    const personCount = Array.isArray(counts) && counts[0] && typeof counts[0] === 'object'
      ? Number((counts[0] as { count?: number }).count ?? 0)
      : 0;

    return {
      id: str(row.id),
      displayName: str(row.display_name),
      customerType: row.customer_type as CustomerType,
      updatedAt: str(row.updated_at),
      personCount,
    };
  });
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customers')
    .select(`
      id, display_name, customer_type, correspondence_language, external_ref,
      customer_persons (
        id, person_role, first_name, last_name, date_of_birth, sex, marital_status,
        phone, email, occupation, employer, employment_type, annual_income_cents, deleted_at
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;

  const rawPersons = Array.isArray(data.customer_persons) ? data.customer_persons : [];
  const order: Record<string, number> = { PRIMARY: 0, PARTNER: 1, CHILD: 2, OTHER: 3 };

  const persons = rawPersons
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .filter((p) => p.deleted_at == null)
    .map((p): Person => ({
      id: str(p.id),
      personRole: p.person_role as PersonRole,
      firstName: str(p.first_name),
      lastName: str(p.last_name),
      dateOfBirth: nullable(p.date_of_birth),
      sex: p.sex as Sex,
      maritalStatus: (p.marital_status as MaritalStatus | null) ?? null,
      phone: nullable(p.phone),
      email: nullable(p.email),
      occupation: nullable(p.occupation),
      employer: nullable(p.employer),
      employmentType: (p.employment_type as EmploymentType | null) ?? null,
      annualIncomeCents: p.annual_income_cents == null ? null : Number(p.annual_income_cents),
    }))
    .sort((a, b) => (order[a.personRole] ?? 9) - (order[b.personRole] ?? 9));

  return {
    id: str(data.id),
    displayName: str(data.display_name),
    customerType: data.customer_type as CustomerType,
    correspondenceLanguage: data.correspondence_language as Language,
    externalRef: nullable(data.external_ref),
    persons,
  };
}

export async function countCustomers(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);
  return count ?? 0;
}
