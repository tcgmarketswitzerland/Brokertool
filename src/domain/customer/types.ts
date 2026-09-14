/** Fachliche Typen des Kundenmodells (ADR-003). Framework-frei. */

export const CUSTOMER_TYPES = ['PRIVATE', 'COUPLE', 'FAMILY', 'COMPANY'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const PERSON_ROLES = ['PRIMARY', 'PARTNER', 'CHILD', 'OTHER'] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

export const SEXES = ['FEMALE', 'MALE', 'UNSPECIFIED'] as const;
export type Sex = (typeof SEXES)[number];

export const MARITAL_STATUSES = [
  'SINGLE', 'MARRIED', 'REGISTERED_PARTNERSHIP', 'DIVORCED', 'WIDOWED', 'SEPARATED',
] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const EMPLOYMENT_TYPES = [
  'EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED', 'RETIRED', 'STUDENT', 'HOMEMAKER', 'OTHER',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const LANGUAGES = ['de', 'fr', 'it', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  PRIVATE: 'Einzelperson',
  COUPLE: 'Paar',
  FAMILY: 'Familie',
  COMPANY: 'Unternehmen',
};

export const PERSON_ROLE_LABEL: Record<PersonRole, string> = {
  PRIMARY: 'Hauptperson',
  PARTNER: 'Partnerin oder Partner',
  CHILD: 'Kind',
  OTHER: 'Weitere Person',
};

export const SEX_LABEL: Record<Sex, string> = {
  FEMALE: 'Weiblich',
  MALE: 'Männlich',
  UNSPECIFIED: 'Keine Angabe',
};

export const MARITAL_STATUS_LABEL: Record<MaritalStatus, string> = {
  SINGLE: 'Ledig',
  MARRIED: 'Verheiratet',
  REGISTERED_PARTNERSHIP: 'Eingetragene Partnerschaft',
  DIVORCED: 'Geschieden',
  WIDOWED: 'Verwitwet',
  SEPARATED: 'Getrennt',
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  EMPLOYED: 'Angestellt',
  SELF_EMPLOYED: 'Selbstständig',
  UNEMPLOYED: 'Ohne Anstellung',
  RETIRED: 'Pensioniert',
  STUDENT: 'In Ausbildung',
  HOMEMAKER: 'Haushalt',
  OTHER: 'Anderes',
};

export const LANGUAGE_LABEL: Record<Language, string> = {
  de: 'Deutsch', fr: 'Französisch', it: 'Italienisch', en: 'Englisch',
};
