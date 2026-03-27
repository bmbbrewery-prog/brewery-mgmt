import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function repro() {
  try {
    const user = await prisma.user.findFirst({ 
      where: { email: "demo@example.com" },
      include: { memberships: true } 
    });
    if (!user || user.memberships.length === 0) {
      console.log("User or membership not found");
      return;
    }

    const orgId = user.memberships[0].organizationId;

    const template = await prisma.template.findFirst({ 
      where: { organizationId: orgId },
      include: { tasks: true } 
    });
    if (!template) {
      console.log("Template not found");
      return;
    }

    const tank = await prisma.tank.findFirst({
      where: { organizationId: orgId }
    });
    if (!tank) {
      console.log("Tank not found");
      return;
    }

    console.log("Attempting to create batch with:", {
      name: "Repro Batch",
      templateId: template.id,
      brewDate: new Date().toISOString(),
      tankId: tank.id,
      organizationId: orgId
    });

    // Simulate the POST logic manually to see where it fails
    const brewDateStr = new Date().toISOString();
    const batch = await prisma.batch.create({
      data: {
        name: "Repro Batch",
        templateId: template.id,
        brewDate: new Date(brewDateStr),
        userId: user.id,
        organizationId: orgId,
        mainTankId: tank.id,
      },
    });

    console.log("Batch created:", batch.id);

    const tasksData = template.tasks.map((t: any) => ({
      name: t.name,
      date: new Date(new Date(brewDateStr).getTime() + t.offsetDays * 24 * 60 * 60 * 1000),
      batchId: batch.id,
      tankId: t.isTankMovement ? null : tank.id,
      offsetDays: t.offsetDays,
      isTankMovement: t.isTankMovement,
    }));

    console.log("Tasks data created, attempting createMany...");

    const createdTasks = await prisma.task.createMany({
      data: tasksData,
    });

    console.log("Tasks created:", createdTasks.count);
  } catch (err) {
    console.error("Repro failed with error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

repro();
