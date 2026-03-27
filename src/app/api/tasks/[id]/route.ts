import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getOrgAuth } from "@/lib/auth-sync";

// DELETE /api/tasks/[id] — With cascading for movements and safety CIP capping
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    
    // 1. Get the target task metadata - SECURITY CHECK
    const target = await prisma.task.findUnique({
       where: { id: taskId },
       include: { batch: true }
    });
    if (!target) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (target.batch.organizationId !== orgId) {
      return NextResponse.json({ error: "Unauthorized access to this task" }, { status: 403 });
    }

    const { batchId, offsetDays, isTankMovement, isCIP } = target;

    // 2. Perform deletion in a transaction
    await prisma.$transaction(async (tx) => {
       const normName = (target.name || "").normalize('NFKC').toLowerCase();
       const isMoveTrigger = target.isTankMovement || 
                             normName.includes("移送") || normName.includes("受入") || 
                             normName.includes("transfer") || normName.includes("arrival");

       if (isMoveTrigger) {
          console.log(`[DELETE] Per-tank cascade for "${target.name}" @ Day ${offsetDays}`);
          
          // 1. Wipe everything from this offset forward in the batch
          await tx.task.deleteMany({
            where: { batchId, offsetDays: { gte: offsetDays ?? 0 } }
          });

          // 2. Identify all tanks that STILL have tasks for this batch
          const remainingTasks = await tx.task.findMany({
             where: { batchId },
             orderBy: { offsetDays: 'asc' }
          });

          // Get unique tank IDs involved in the remaining batch
          const activeTankIds = Array.from(new Set(remainingTasks.map(t => t.tankId)));

          for (const tId of activeTankIds) {
             const tasksInTank = remainingTasks.filter(t => t.tankId === tId);
             if (tasksInTank.length === 0) continue;

             const lastInTank = tasksInTank[tasksInTank.length - 1];
             const lastNorm = (lastInTank.name || "").normalize('NFKC').toLowerCase();
             const hasCIP = lastInTank.isCIP || lastNorm.includes("cip");

             if (!hasCIP) {
                const nextOffset = (lastInTank.offsetDays ?? 0) + 1;
                const nextDate = new Date(lastInTank.date.getTime() + 86400000);
                nextDate.setHours(0,0,0,0);

                console.log(`[DELETE] Adding auto-CIP1 to tank ${tId} at Day ${nextOffset}`);
                await tx.task.create({
                  data: {
                    batchId,
                    tankId: tId,
                    name: "CIP1",
                    offsetDays: nextOffset,
                    date: nextDate,
                    isCIP: true,
                    isTankMovement: false
                  }
                });
             }
          }
       } else {
          // Standard deletion
          await tx.task.delete({ where: { id: taskId } });
       }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cascading delete error:", error);
    return NextResponse.json({ error: "Failed to delete task", message: error.message }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] — update specific task's date/tank/name
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { name, date, tankId, daysDelta } = body;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { batch: true },
    });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (task.batch.organizationId !== orgId) {
      return NextResponse.json({ error: "Unauthorized access to this task" }, { status: 403 });
    }

    let newDate = task.date;
    if (date) {
      newDate = new Date(date);
    } else if (typeof daysDelta === "number") {
      newDate = new Date(task.date.getTime() + daysDelta * 86400000);
    }
    newDate.setHours(0,0,0,0);

    // Conflict Check (Interval-aware)
    if (task.tankId) {
      // 1. Fetch ALL other tasks in this tank for this batch to find the NEW segment range
      const siblingTasks = await prisma.task.findMany({
         where: { batchId: task.batchId, tankId: task.tankId, id: { not: id } }
      });
      const currentSegmentTasks = [...siblingTasks, { ...task, date: newDate }].sort((a,b) => (a.offsetDays || 0) - (b.offsetDays || 0));
      
      const brewT = currentSegmentTasks.find(tk => tk.offsetDays === 0);
      const moveInT = currentSegmentTasks.find(tk => tk.isTankMovement && currentSegmentTasks.length > 1);
      const segStart = new Date(brewT?.date || moveInT?.date || Math.min(...currentSegmentTasks.map(t => new Date(t.date).getTime())));
      
      const cipT = currentSegmentTasks.find(t => t.isCIP);
      const segEnd = new Date(cipT?.date || Math.max(...currentSegmentTasks.map(t => new Date(t.date).getTime())));

      // 2. Check overlap against other batches' segments (within the same org)
      const otherTasks = await prisma.task.findMany({
        where: { 
          tankId: task.tankId, 
          batchId: { not: task.batchId },
          batch: { organizationId: orgId } // Security filter
        },
        orderBy: { date: 'asc' }
      });

      const otherBatchMap: Record<string, any[]> = {};
      otherTasks.forEach(t => {
        if (!otherBatchMap[t.batchId]) otherBatchMap[t.batchId] = [];
        otherBatchMap[t.batchId].push(t);
      });

      for (const bId in otherBatchMap) {
        const bTasks = [...otherBatchMap[bId]].sort((a,b) => (a.offsetDays || 0) - (b.offsetDays || 0));
        let obsStart: Date | null = null;
        for (let i = 0; i < bTasks.length; i++) {
          const t = bTasks[i];
          if (!obsStart) {
             const isB = t.offsetDays === 0;
             const isAr = t.isTankMovement || t.name?.includes("受入");
             if (isB || isAr) {
               obsStart = new Date(t.date);
             } else if (i === bTasks.length - 1) {
               const firstNonPre = bTasks.find(tk => (tk.offsetDays || 0) >= 0);
               obsStart = new Date((firstNonPre || bTasks[0]).date);
             }
          }
          if (t.isCIP || i === bTasks.length - 1) {
            if (obsStart) {
              const obsEnd = new Date(t.date);
              if (segStart <= obsEnd && segEnd >= obsStart) {
                const b = await prisma.batch.findUnique({ where: { id: bId }, select: { name: true } });
                return NextResponse.json({ 
                  error: `衝突検知: タンク は ${obsStart.toLocaleDateString()}〜${obsEnd.toLocaleDateString()} の間、バッチ「${b?.name || '不明'}」が占有しています。` 
                }, { status: 409 });
              }
            }
            obsStart = null;
          }
        }
      }

      // 3. Check work schedules
      const work = await prisma.workSchedule.findFirst({
         where: {
            tankId: task.tankId,
            organizationId: orgId,
            OR: [{ startDate: { lte: segEnd }, endDate: { gte: segStart } }]
         }
      });
      if (work) {
        return NextResponse.json({ error: `衝突検知: タンク はこの期間中に業務予定「${work.name}」が入っています。` }, { status: 409 });
      }
    }

    const newOffset = Math.floor((newDate.getTime() - task.batch.brewDate.getTime()) / 86400000);

    const updated = await prisma.task.update({
      where: { id },
      data: {
        name: name !== undefined ? name : task.name,
        date: newDate,
        tankId: tankId !== undefined ? tankId : task.tankId,
        offsetDays: newOffset,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH task error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
