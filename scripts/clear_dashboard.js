
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning up all dashboard data ---');
  try {
    const tasksCount = await prisma.task.deleteMany({});
    console.log(`Deleted ${tasksCount.count} tasks.`);
    
    const batchesCount = await prisma.batch.deleteMany({});
    console.log(`Deleted ${batchesCount.count} batches.`);
    
    const workCount = await prisma.workSchedule.deleteMany({});
    console.log(`Deleted ${workCount.count} work schedules.`);

    console.log('--- Cleanup complete ---');
  } catch (err) {
    console.error('Cleanup error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
