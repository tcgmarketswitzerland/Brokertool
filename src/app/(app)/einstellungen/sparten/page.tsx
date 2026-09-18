import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { listTopicSelection } from '@/features/topics/queries';
import { TopicSelection } from '@/features/topics/topic-selection';
import { currentMember } from '@/features/members/queries';

export const metadata: Metadata = { title: 'Versicherungssparten' };
export const dynamic = 'force-dynamic';

export default async function TopicsPage() {
  const [topics, me] = await Promise.all([listTopicSelection(), currentMember()]);
  const canManage = me?.role === 'OWNER' || me?.role === 'ADMIN';

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl">Versicherungssparten</h1>
        <p className="text-sm text-ink-muted">
          Was Ihre Beratung abdeckt und in welcher Reihenfolge.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auswahl und Reihenfolge</CardTitle>
          <CardDescription>
            Die Reihenfolge ist die Reihenfolge im Beratungsrad. Ein Pflichtthema braucht ein
            Ergebnis, bevor sich eine Beratung abschliessen lässt — „im Gespräch nicht
            thematisiert&ldquo; zählt dabei als Ergebnis. Eine Änderung gilt für neue Beratungen;
            laufende behalten ihre bisherige Auswahl.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <TopicSelection topics={topics} />
          ) : (
            <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
              Die Spartenauswahl ändert die Firmenleitung.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
