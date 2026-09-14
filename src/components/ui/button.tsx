import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const button = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'font-medium transition-[background-color,border-color,color] duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // Genau eine kraeftige Aktion pro Ansicht. Sobald zwei Knoepfe um
        // Aufmerksamkeit kaempfen, trifft der Nutzer keine Entscheidung mehr.
        primary: 'bg-accent text-ink-inverted hover:bg-accent-hover',
        secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-hover',
        ghost: 'text-ink-muted hover:bg-surface-hover hover:text-ink',
        danger: 'bg-danger text-white hover:brightness-110',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[0.8125rem] [&_svg]:size-3.5',
        md: 'h-9 px-3.5 text-sm [&_svg]:size-4',
        lg: 'h-11 px-5 text-[0.9375rem] [&_svg]:size-4',
        icon: 'size-9 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className, variant, size, asChild = false, loading = false,
  children, disabled, ...props
}: ButtonProps) {
  // Slot vertraegt genau ein Kind. Der Lade-Platzhalter wuerde ein zweites
  // erzeugen - auch als null -, und die Komponente scheitert dann mit
  // "Slot failed to slot onto its children". Deshalb der eigene Zweig:
  // ein asChild-Knopf ist ohnehin meist ein Link und kennt kein Laden.
  if (asChild) {
    return (
      <Slot className={cn(button({ variant, size }), className)} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={cn(button({ variant, size }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export { button as buttonVariants };
