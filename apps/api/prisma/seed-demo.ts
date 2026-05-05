/**
 * Seeds the demo/review account used by App Store + Play reviewers.
 *
 * Usage (local):
 *   pnpm --filter @app-bus/api prisma:db push
 *   DEMO_PASSWORD=… pnpm --filter @app-bus/api ts-node prisma/seed-demo.ts
 *
 * The password is read from env so it stays out of git. Production runs this
 * via a one-shot ECS task before each store submission cycle.
 */

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    console.error('DEMO_PASSWORD env var required');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 64 * 1024,
    parallelism: 4,
    timeCost: 3,
  });

  const demo = await prisma.user.upsert({
    where: { email: 'betademo@app-bus.tr' },
    create: {
      email: 'betademo@app-bus.tr',
      password_hash: passwordHash,
      name: 'Beta Reviewer',
      locale: 'tr',
      email_verified: true,
      kvkk_consents: { create: { version: '2026-05-05', marketing_opt_in: false } },
    },
    update: {
      password_hash: passwordHash,
    },
  });

  console.log(`demo user ready: ${demo.email} (id=${demo.id})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
