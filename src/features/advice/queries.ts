import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CoverageState, Outcome, ProgressStatus } from '@/domain/advice/status';

export type SessionTopic = {
  id: string;
  topicId: string;
  slug: string;
  name: string;
  category: string;
  icon: string | null;
  displayOrder: number;
  isRequired: boolean;
  progressStatus: ProgressStatus;
  outcome: Outcome | null;
  coverageState: CoverageState;
  priority: number | null;
};

export type SessionNote = {
  id: string;
  sessionTopicId: string | null;
  visibility: 'INTERNAL' | 'SHARED';
  body: string;
};

export type AdviceSession = {
  id: string;
  organizationId: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  customerId: string;
  customerName: string;
  advisorName: string;
  startedAt: string | null;
  completedAt: string | null;
  participants: string[];
  topics: SessionTopic[];
  notes: SessionNote[];
};

/**
 * Eingebettete Relationen lassen sich ohne generierte Datenbanktypen nicht
 * inferieren - der Platzhaltertyp kennt keine Beziehungen. Diese eine
 * Stelle kapselt die Umwandlung, statt sie ueber fuenf Aufrufe zu
 * verstreuen. Sobald `pnpm db:types` gegen das echte Schema laeuft, faellt
 * der Helfer ersatzlos weg.
 */
function row(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(row) : [];
}

/** Deutscher Name aus dem mehrsprachigen Katalogfeld (ADR-004). */
function nameOf(value: unknown, language = 'de'): string {
  if (typeof value !== 'object' || value === null) return '';
  const record = value as Record<string, unknown>;
  return String(record[language] ?? record['de'] ?? '');
}

export async function getSession(sessionId: string): Promise<AdviceSession | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('advice_sessions')
    .select(`
      id, organization_id, status, started_at, completed_at, customer_id,
      customers ( display_name ),
      organization_members ( display_name ),
      advice_session_participants ( display_name, attended ),
      advice_session_topics (
        id, topic_id, display_order, is_required, progress_status, outcome,
        coverage_state, priority,
        insurance_topics ( slug, name, category, icon )
      ),
      notes ( id, session_topic_id, visibility, body )
    `)
    .eq('id', sessionId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;

  const topics = rows(data.advice_session_topics)
    .map((t): SessionTopic => {
      const catalog = row(t.insurance_topics);
      return {
        id: String(t.id),
        topicId: String(t.topic_id),
        slug: String(catalog.slug ?? ''),
        name: nameOf(catalog.name),
        category: String(catalog.category ?? ''),
        icon: catalog.icon == null ? null : String(catalog.icon),
        displayOrder: Number(t.display_order ?? 0),
        isRequired: Boolean(t.is_required),
        progressStatus: t.progress_status as ProgressStatus,
        outcome: (t.outcome as Outcome | null) ?? null,
        coverageState: t.coverage_state as CoverageState,
        priority: t.priority == null ? null : Number(t.priority),
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const notes = rows(data.notes)
    .map((n): SessionNote => ({
      id: String(n.id),
      sessionTopicId: n.session_topic_id == null ? null : String(n.session_topic_id),
      visibility: n.visibility as 'INTERNAL' | 'SHARED',
      body: String(n.body ?? ''),
    }));

  const customer = row(data.customers);
  const advisor = row(data.organization_members);

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    status: data.status as AdviceSession['status'],
    customerId: String(data.customer_id),
    customerName: String(customer.display_name ?? 'Kunde'),
    advisorName: String(advisor.display_name ?? ''),
    startedAt: data.started_at == null ? null : String(data.started_at),
    completedAt: data.completed_at == null ? null : String(data.completed_at),
    participants: rows(data.advice_session_participants)
      .filter((p) => p.attended !== false)
      .map((p) => String(p.display_name ?? '')),
    topics,
    notes,
  };
}

export type SessionListItem = {
  id: string;
  customerName: string;
  status: AdviceSession['status'];
  startedAt: string | null;
  settled: number;
  total: number;
};

export async function listSessions(): Promise<SessionListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('advice_sessions')
    .select(`
      id, status, started_at,
      customers ( display_name ),
      advice_session_topics ( progress_status, outcome )
    `)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((entry) => {
    const r = row(entry);
    const customer = row(r.customers);
    const topics = rows(r.advice_session_topics);
    const settled = topics.filter(
      (t) => t.progress_status === 'SKIPPED' || t.outcome != null).length;

    return {
      id: String(r.id),
      customerName: String(customer.display_name ?? 'Kunde'),
      status: r.status as AdviceSession['status'],
      startedAt: r.started_at == null ? null : String(r.started_at),
      settled,
      total: topics.length,
    };
  });
}
