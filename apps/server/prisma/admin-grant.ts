/**
 * Da (o quita) el rol de administrador a una cuenta por su correo.
 *
 *   pnpm --filter @tecleo/server admin:grant ana@example.com
 *   pnpm --filter @tecleo/server admin:grant ana@example.com --revoke
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error('Uso: admin:grant <correo> [--revoke]');
  process.exit(1);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Falta DATABASE_URL');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  const role = flag === '--revoke' ? 'user' : 'admin';
  const { count } = await prisma.user.updateMany({
    where: { email: email.trim().toLowerCase() },
    data: { role },
  });
  if (count === 0) {
    console.error(`No hay ninguna cuenta con el correo ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`${email}: rol ${role}`);
  }
} finally {
  await prisma.$disconnect();
}
