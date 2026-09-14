import { z } from 'zod';
import { emailSchema } from '@/features/auth/schemas';

export const ORG_ROLES = ['OWNER', 'ADMIN', 'ADVISOR', 'BACKOFFICE'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: 'Inhaber',
  ADMIN: 'Administrator',
  ADVISOR: 'Berater',
  BACKOFFICE: 'Backoffice',
};

export const ROLE_DESCRIPTION: Record<OrgRole, string> = {
  OWNER: 'Alles, inklusive Firma, Abrechnung und Benutzerverwaltung.',
  ADMIN: 'Kunden, Beratungen und Benutzer. Keine Abrechnung.',
  ADVISOR: 'Kunden und Beratungen führen, Beratungen abschliessen.',
  BACKOFFICE: 'Kunden, Verträge und Aufgaben pflegen. Führt keine Beratung.',
};

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(ORG_ROLES),
});

export const changeRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(ORG_ROLES),
});

export const memberIdSchema = z.object({ memberId: z.string().uuid() });

export type ActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string; inviteUrl?: string }
  | { status: 'error'; message: string };
