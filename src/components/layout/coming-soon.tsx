import { Card, CardContent } from '@/components/ui';

/**
 * Platzhalter fuer Bereiche, die in einer spaeteren Phase entstehen. Bewusst
 * ehrlich beschriftet statt mit erfundenen Beispieldaten gefuellt: eine leere
 * Ansicht, die so tut als waere sie fertig, kostet beim Vorfuehren
 * Glaubwuerdigkeit.
 */
export function ComingSoon({
  title, phase, description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl">{title}</h1>
      <Card>
        <CardContent className="grid gap-2 py-12 text-center">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.07em] text-ink-subtle">
            {phase}
          </p>
          <p className="mx-auto max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
            {description}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
