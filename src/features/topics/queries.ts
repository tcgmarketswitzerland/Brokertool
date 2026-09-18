import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type TopicChoice = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  isEnabled: boolean;
  isRequired: boolean;
  displayOrder: number;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * Die Spartenauswahl der Firma.
 *
 * Drei Quellen, in dieser Rangfolge: was die Firma zuletzt eingestellt
 * hat, was in der veroeffentlichten Vorlage steht, und zuletzt der
 * Katalog. Die Einstellungen kennen auch die abgewaehlten Sparten - die
 * Vorlage enthaelt nur die aktiven und koennte deshalb nicht sagen, ob
 * eine Sparte abgewaehlt oder nie angesehen wurde.
 */
export async function listTopicSelection(): Promise<TopicChoice[]> {
  const supabase = await createClient();

  const [catalog, settings, version] = await Promise.all([
    supabase.from('insurance_topics')
      .select('id, slug, name, icon, display_order, applicable_customer_types')
      .eq('is_active', true)
      .order('display_order'),
    supabase.from('organization_topic_settings')
      .select('topic_id, is_enabled, display_order'),
    // Ausdruecklich die Standardvorlage: start_advice_session nimmt genau
    // diese, und eine Firma koennte spaeter mehrere haben.
    supabase.from('advice_template_versions')
      .select(`id, version,
               advice_templates!inner ( is_default ),
               advice_template_topics ( topic_id, is_required, display_order )`)
      .eq('status', 'PUBLISHED')
      .eq('advice_templates.is_default', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const chosen = new Map<string, { enabled: boolean; order: number | null }>();
  for (const row of settings.data ?? []) {
    chosen.set(String(row.topic_id), {
      enabled: row.is_enabled !== false,
      order: row.display_order == null ? null : Number(row.display_order),
    });
  }

  const published = new Map<string, { required: boolean; order: number }>();
  const versionTopics = version.data
    ? (record(version.data).advice_template_topics as unknown)
    : null;
  for (const entry of Array.isArray(versionTopics) ? versionTopics : []) {
    const r = record(entry);
    published.set(String(r.topic_id), {
      required: r.is_required === true,
      order: Number(r.display_order ?? 0),
    });
  }

  return (catalog.data ?? [])
    .filter((row) => {
      const types = row.applicable_customer_types;
      return !Array.isArray(types) || types.includes('PRIVATE');
    })
    .map((row) => {
      const id = String(row.id);
      const setting = chosen.get(id);
      const inVersion = published.get(id);

      return {
        id,
        slug: String(row.slug),
        name: String(record(row.name).de ?? row.slug),
        icon: row.icon == null ? null : String(row.icon),
        // Ohne Einstellung und ohne Vorlage ist eine Sparte aktiv: eine
        // frisch angelegte Firma soll alles sehen, nicht nichts.
        isEnabled: setting?.enabled ?? (published.size === 0 ? true : inVersion !== undefined),
        isRequired: inVersion?.required ?? false,
        displayOrder: setting?.order ?? inVersion?.order ?? Number(row.display_order ?? 0),
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
