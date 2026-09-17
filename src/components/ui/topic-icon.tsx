import {
  Building2, Car, HeartPulse, KeyRound, Laptop, PiggyBank, Plane, Scale,
  Shield, Shapes, Sofa, Umbrella,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Symbol einer Versicherungssparte.
 *
 * Die Zuordnung steht hier und nicht in der Datenbank: dort liegt nur der
 * Name des Symbols. So laesst sich der Icon-Satz austauschen, ohne eine
 * Migration zu schreiben - und ein unbekannter Name faellt auf ein neutrales
 * Zeichen zurueck, statt eine Luecke in Liste und Rad zu hinterlassen.
 */
const ICONS = {
  sofa: Sofa,                 // Hausrat
  shield: Shield,             // Privathaftpflicht
  building: Building2,        // Gebäude
  car: Car,                   // Motorfahrzeuge
  scale: Scale,               // Rechtsschutz
  plane: Plane,               // Reise
  laptop: Laptop,             // Cyber
  'heart-pulse': HeartPulse,  // Krankenkasse
  umbrella: Umbrella,         // Risiko
  'piggy-bank': PiggyBank,    // Vorsorge
  'key-round': KeyRound,      // Hypothek
} as const;

export type TopicIconName = keyof typeof ICONS;

export function TopicIcon({
  name, className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = ICONS[name as TopicIconName] ?? Shapes;
  return <Icon aria-hidden className={cn('size-4', className)} strokeWidth={1.9} />;
}

/**
 * Dasselbe Symbol innerhalb eines SVG, an einer Koordinate verankert.
 *
 * Ein verschachteltes <svg> statt CSS-Groessen: im Rad steht das Symbol an
 * einer berechneten Stelle, und Groessenangaben in Prozent oder rem haetten
 * dort keinen Bezugsrahmen.
 */
export function TopicGlyph({
  name, x, y, size = 26, strokeWidth = 1.7,
}: {
  name: string | null | undefined;
  /** Mittelpunkt, nicht obere linke Ecke - so rechnet das Rad. */
  x: number;
  y: number;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = ICONS[name as TopicIconName] ?? Shapes;
  return (
    <Icon
      aria-hidden
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
    />
  );
}
