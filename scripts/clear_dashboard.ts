
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning up all dashboard data ---');
  
  const tasksCount = await prisma.task.deleteMany({});
  console.log(`Deleted ${tasksCount.count} tasks.`);
  
  const batchesCount = await prisma.batch.deleteMany({});
  console.log(`Deleted ${batchesCount.count} batches.`);
  
  const workCount = await prisma.workSchedule.deleteMany({});
  console.log(`Deleted ${workCount.count} work schedules.`);

  console.log('--- Cleanup complete ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
