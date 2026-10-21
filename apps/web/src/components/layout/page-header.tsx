import type { ReactNode } from 'react';

export function PageHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <header className="flex max-w-2xl flex-col gap-2">
      <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {description && <p className="text-lg text-muted-foreground">{description}</p>}
    </header>
  );
}
