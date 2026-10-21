import type { Metadata } from 'next';

import { PracticeScreen } from '@/features/practice/practice-screen';

export const metadata: Metadata = { title: 'Práctica · Tecleo' };

export default function PracticePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center gap-8 px-6 py-12">
      <h1 className="sr-only">Práctica</h1>
      <PracticeScreen />
    </main>
  );
}
