import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { TaskOwner, TaskPriority, TaskStatus } from '@/domain/task/types';

export type Task = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  sessionId: string | null;
  ownerType: TaskOwner;
  assigneeName: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
};

function row(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function toTask(entry: unknown): Task {
  const r = row(entry);
  return {
    id: String(r.id),
    customerId: r.customer_id == null ? null : String(r.customer_id),
    customerName: (() => {
      const name = row(r.customers).display_name;
      return name == null ? null : String(name);
    })(),
    sessionId: r.session_id == null ? null : String(r.session_id),
    ownerType: r.owner_type as TaskOwner,
    assigneeName: (() => {
      const name = row(r.organization_members).display_name;
      return name == null ? null : String(name);
    })(),
    title: String(r.title ?? ''),
    description: r.description == null ? null : String(r.description),
    status: r.status as TaskStatus,
    priority: r.priority as TaskPriority,
    dueDate: r.due_date == null ? null : String(r.due_date),
  };
}

const SELECT = `
  id, customer_id, session_id, owner_type, title, description, status, priority, due_date,
  customers ( display_name ),
  organization_members ( display_name )
`;

export async function listTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks').select(SELECT)
    .order('status').order('due_date', { nullsFirst: false }).limit(300);
  return (data ?? []).map(toTask);
}

export async function listSessionTasks(sessionId: string): Promise<Task[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks').select(SELECT).eq('session_id', sessionId).order('owner_type');
  return (data ?? []).map(toTask);
}

export async function listCustomerTasks(customerId: string): Promise<Task[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks').select(SELECT).eq('customer_id', customerId)
    .order('status').order('due_date', { nullsFirst: false });
  return (data ?? []).map(toTask);
}

export async function countOpenTasks(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('tasks').select('id', { count: 'exact', head: true })
    .in('status', ['OPEN', 'IN_PROGRESS']);
  return count ?? 0;
}
