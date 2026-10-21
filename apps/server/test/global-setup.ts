import { execFileSync } from 'node:child_process';

/** Aplica las migraciones a la base de prueba antes de correr nada. */
export default function setup() {
  const url =
    process.env.DATABASE_URL_TEST ?? 'postgresql://tecleo:tecleo@localhost:5440/tecleo_test';
  try {
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: url },
    });
  } catch (error) {
    const output = error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
    const target = url.replace(/\/\/[^@]*@/, '//***@');
    throw new Error(`No se pudo migrar la base de prueba (${target}). ¿Está levantada?\n${output}`);
  }
}
