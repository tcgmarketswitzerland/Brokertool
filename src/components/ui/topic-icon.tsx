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
