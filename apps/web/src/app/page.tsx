import Link from 'next/link';

import { ServerStatus } from './server-status';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="font-mono text-5xl font-semibold tracking-tight">tecleo</h1>
      <p className="text-lg text-zinc-300">
        Carreras de mecanografía en tiempo real contra personas y bots.
      </p>
      <Link
        href="/practice"
        className="w-fit rounded-md bg-amber-300 px-5 py-2.5 font-medium text-zinc-950 hover:bg-amber-200"
      >
        Practicar
      </Link>
      <ServerStatus />
    </main>
  );
}
