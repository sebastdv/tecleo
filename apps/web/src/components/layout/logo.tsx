import { cn } from '@/lib/utils';

/** Marca: "tecleo" con el cursor de latón como un tipo más en la línea. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-heading text-xl font-bold tracking-tight',
        className,
      )}
    >
      tecleo
      <span
        aria-hidden="true"
        className="ml-0.5 inline-block h-[0.9em] w-[0.18em] translate-y-[0.1em] rounded-[1px] bg-primary"
      />
    </span>
  );
}
