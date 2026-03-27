import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orgId = 'org_demo';
  const userId = 'user_demo';

  console.log('Upserting demo organization...');
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId,
      name: 'Sample Brewery',
    },
  });

  console.log('Upserting demo user...');
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: 'demo@example.com',
      name: 'Demo User',
    },
  });

  console.log('Creating membership...');
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    update: {},
    create: {
      userId,
      organizationId: orgId,
      role: 'admin',
    },
  });

  const tanksCount = await prisma.tank.count({ where: { organizationId: orgId } });
  if (tanksCount === 0) {
    console.log('Creating demo tanks...');
    const tanks = [
      { name: 'FV-01', type: 'FV', capacity: 1000, organizationId: orgId, sortOrder: 1 },
      { name: 'FV-02', type: 'FV', capacity: 1000, organizationId: orgId, sortOrder: 2 },
      { name: 'FV-03', type: 'FV', capacity: 2000, organizationId: orgId, sortOrder: 3 },
      { name: 'BBT-01', type: 'BBT', capacity: 1000, organizationId: orgId, sortOrder: 4 },
      { name: 'イベント/その他', type: 'OTHER', organizationId: orgId, sortOrder: 5 },
    ];

    for (const tank of tanks) {
      await prisma.tank.create({ data: tank });
    }
  }

  const existingTemplate = await prisma.template.findFirst({
    where: { name: 'Standard Ale', organizationId: orgId },
  });

  if (!existingTemplate) {
    console.log('Creating demo template...');
    await prisma.template.create({
      data: {
        name: 'Standard Ale',
        description: 'Standard Ale fermentation schedule',
        organizationId: orgId,
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
