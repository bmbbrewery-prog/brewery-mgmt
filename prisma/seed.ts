import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      breweryName: 'Sample Brewery',
    },
  });

  const tanksCount = await prisma.tank.count();
  if (tanksCount === 0) {
    const tanks = [
      { name: 'FV-01', type: 'FV', capacity: 1000, userId: user.id, sortOrder: 1 },
      { name: 'FV-02', type: 'FV', capacity: 1000, userId: user.id, sortOrder: 2 },
      { name: 'FV-03', type: 'FV', capacity: 2000, userId: user.id, sortOrder: 3 },
      { name: 'BBT-01', type: 'BBT', capacity: 1000, userId: user.id, sortOrder: 4 },
      { name: 'イベント/その他', type: 'OTHER', userId: user.id, sortOrder: 5 },
    ];

    for (const tank of tanks) {
      await prisma.tank.create({ data: tank });
    }
  }

  const existingTemplate = await prisma.template.findFirst({
    where: { name: 'Standard Ale' },
  });

  if (!existingTemplate) {
    await prisma.template.create({
      data: {
        name: 'Standard Ale',
        description: 'Standard Ale fermentation schedule',
        userId: user.id,
        tasks: {
          create: [
            { name: 'デザイン依頼', offsetDays: -20 },
            { name: 'ラベル入稿', offsetDays: -10 },
            { name: '仕込み', offsetDays: 0 },
            { name: '発酵終了', offsetDays: 5 },
            { name: 'ダイアセルレスト', offsetDays: 7 },
            { name: '温度下げ開始', offsetDays: 8 },
            { name: '移送 (BBTへ)', offsetDays: 14, isTankMovement: true },
          ],
        },
      },
    });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
