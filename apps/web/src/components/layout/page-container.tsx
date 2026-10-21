import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14',
        className,
      )}
    >
      {children}
    </div>
  );
}
