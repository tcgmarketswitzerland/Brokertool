import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { TopicOption } from './policy-section';

/**
 * Aktive Sparten fuer die Vertragserfassung. Die Ueberlagerung je Firma
 * wird beruecksichtigt: eine abgeschaltete Sparte taucht hier nicht auf.
 */
export async function listTopicOptions(): Promise<TopicOption[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('insurance_topics')
    .select('id, name, icon, display_order')
    .eq('is_active', true)
    .order('display_order');

  const { data: settings } = await supabase
    .from('organization_topic_settings')
    .select('topic_id, is_enabled');

  const disabled = new Set(
    (settings ?? []).filter((s) => s.is_enabled === false).map((s) => String(s.topic_id)),
  );

  return (data ?? [])
    .filter((t) => !disabled.has(String(t.id)))
    .map((t) => {
      const name = t.name as Record<string, unknown> | null;
      return {
        id: String(t.id),
        name: String(name?.['de'] ?? ''),
        icon: t.icon == null ? null : String(t.icon),
      };
    });
}
