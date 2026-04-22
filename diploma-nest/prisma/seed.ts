import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const INTERESTS = [
  'Спорт',
  '🎾 Теніс / Бадмінтон',
  '🏃 Біг',
  '🚲 Велопрогулянки',
  '🧘 Йога / Пілатес',
  '🛹 Скейтбординг / Ролики',
  '🏐 Волейбол / Футбол',
  '🏋️ Фітнес / Зал',
];

async function main() {
  console.log('Seeding interests...');

  for (const name of INTERESTS) {
    await prisma.interest.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✔ ${name}`);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
