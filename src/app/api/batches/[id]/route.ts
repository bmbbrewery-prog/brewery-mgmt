import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgAuth } from "@/lib/auth-sync";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: batchId } = await params;
    const { name, tankIds, newTransferDates, color } = await req.json();

    if (!Array.isArray(tankIds)) {
      return NextResponse.json({ error: "tankIds must be an array" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get current batch and tasks - SECURITY CHECK: MUST match organizationId
      const batch = await tx.batch.findUnique({ 
        where: { id: batchId, organizationId: orgId },
        include: { tasks: { orderBy: { offsetDays: 'asc' } } }
      });
      if (!batch) throw new Error("Batch not found or access denied");

      const existingTasks = batch.tasks;
      // Identify current segments by visited tanks
      const visitedTankIds = Array.from(new Set(existingTasks.map(t => t.tankId)));
      const existingTanksCount = visitedTankIds.length;

      // 2. EXPANSION LOGIC: If tankIds.length > existingTanksCount, we need to extend the chain
      if (tankIds.length > existingTanksCount) {
         console.log(`[Expansion] Growing from ${existingTanksCount} to ${tankIds.length} tanks`);
         
         const batchBrewDate = new Date(batch.brewDate);
         batchBrewDate.setHours(0,0,0,0);

         for (let idx = existingTanksCount; idx < tankIds.length; idx++) {
            const transferDateStr = newTransferDates?.[idx];
            if (!transferDateStr) throw new Error(`${idx+1}番目のタンクの移送日が指定されていません。`);
            
            const transDate = new Date(transferDateStr);
            transDate.setHours(0,0,0,0);

            const offsetDays = Math.round((transDate.getTime() - batchBrewDate.getTime()) / 86400000);
            const prevTankId = tankIds[idx - 1];
            const targetTankId = tankIds[idx];

            // 1. Create 'Transfer (Out)' in the PREVIOUS tank
            await tx.task.create({
               data: {
                  batchId,
                  tankId: prevTankId,
                  name: `移送 ${idx}`,
                  date: transDate,
                  offsetDays: offsetDays,
                  isTankMovement: true,
                  isCIP: false
               }
            });

            // 2. Create 'Arrival' in the NEW tank
            await tx.task.create({
               data: {
                  batchId,
                  tankId: targetTankId,
                  name: `移送 ${idx} (受入)`,
                  date: transDate,
                  offsetDays: offsetDays,
                  isTankMovement: true,
                  isCIP: false
               }
            });

            // 3. Create 'CIP' in the NEW tank
            const cipDate = new Date(transDate.getTime() + 86400000);
            cipDate.setHours(0,0,0,0);

            await tx.task.create({
               data: {
                  batchId,
                  tankId: targetTankId,
                  name: `CIP${idx}`,
                  date: cipDate,
                  offsetDays: offsetDays + 1,
                  isCIP: true,
                  isTankMovement: false
               }
            });
         }
      }

      // 3. RE-FETCH and Group AGAIN to perform conflict validation on the FINAL state
      const allTasks = await tx.task.findMany({
        where: { batchId },
        orderBy: [{ offsetDays: 'asc' }, { isTankMovement: 'desc' }],
      });

      const intervals: { tankId: string, start: Date, end: Date }[] = [];
      let currentTankIdx = 0;
      let curStart: Date | null = null;
      let curEnd: Date | null = null;

      for (let i = 0; i < allTasks.length; i++) {
        const t = allTasks[i];
        if (!curStart) curStart = t.date;
        curEnd = t.date;

        if (t.isCIP || i === allTasks.length - 1) {
           const tankId = tankIds[currentTankIdx] || tankIds[tankIds.length - 1];
           intervals.push({ tankId, start: curStart, end: curEnd });
           currentTankIdx++;
           curStart = null;
        }
      }

      // 4. Validate ALL segments for occupancy conflicts (Restricted to Brew-to-CIP)
      const restrictedIntervals: { tankId: string, start: Date, end: Date }[] = [];
      let rIdx = 0;
      let rSegTasks: any[] = [];
      for (let i = 0; i < allTasks.length; i++) {
         const t = allTasks[i];
         rSegTasks.push(t);
         if (t.isCIP || i === allTasks.length - 1) { 
             // Logic to find restricted range if needed
         }
      }
      // Re-calculating restrictedIntervals properly for the NEW configuration
      currentTankIdx = 0;
      let tempSeg: any[] = [];
      for (let i = 0; i < allTasks.length; i++) {
         const t = allTasks[i];
         tempSeg.push(t);
         if (t.isCIP || i === allTasks.length - 1) {
            const bT = tempSeg.find(tk => tk.offsetDays === 0);
            const mInT = tempSeg.find(tk => tk.isTankMovement && tempSeg.length > 1);
            const sT = bT || mInT || tempSeg[0];
            const eT = tempSeg.find(tk => tk.isCIP) || tempSeg[tempSeg.length - 1];

            const tId = tankIds[currentTankIdx] || tankIds[tankIds.length - 1];
            restrictedIntervals.push({ tankId: tId, start: new Date(sT.date), end: new Date(eT.date) });
            currentTankIdx++;
            tempSeg = [];
         }
      }

      for (const interval of restrictedIntervals) {
         const existingTasksInTank = await tx.task.findMany({
            where: { 
              tankId: interval.tankId, 
              batchId: { not: batchId },
              batch: { organizationId: orgId } // Only check conflicts for the same org
            },
            orderBy: { date: 'asc' }
         });

         const batchMap: Record<string, any[]> = {};
         existingTasksInTank.forEach(t => {
            if (!batchMap[t.batchId]) batchMap[t.batchId] = [];
            batchMap[t.batchId].push(t);
         });

         for (const bId in batchMap) {
            const bTasks = [...batchMap[bId]].sort((a,b) => (a.offsetDays || 0) - (b.offsetDays || 0));
            let bStart: Date | null = null;
            for (let i = 0; i < bTasks.length; i++) {
               const t = bTasks[i];
               if (!bStart) {
                  const isB = t.offsetDays === 0;
                  const isAr = t.isTankMovement || t.name?.includes("受入");
                  if (isB || isAr) {
                     bStart = new Date(t.date);
                  } else if (i === bTasks.length - 1) {
                     const firstNonPre = bTasks.find(tk => (tk.offsetDays || 0) >= 0);
                     bStart = new Date((firstNonPre || bTasks[0]).date);
                  }
               }
               if (t.isCIP || i === bTasks.length - 1) {
                  if (bStart) {
                     const s = bStart;
                     const e = new Date(t.date);
                     if (interval.start <= e && interval.end >= s) {
                        const b = await tx.batch.findUnique({ where: { id: bId }, select: { name: true } });
                        throw new Error(`衝突検知: タンク ${interval.tankId} は ${s.toLocaleDateString()}〜${e.toLocaleDateString()} の間、バッチ「${b?.name || '不明'}」が占有しています。`);
                     }
                  }
                  bStart = null;
               }
            }
         }

         const work = await tx.workSchedule.findFirst({
            where: {
               tankId: interval.tankId,
               organizationId: orgId,
               OR: [
                   { startDate: { lte: interval.end }, endDate: { gte: interval.start } }
               ]
            }
         });
         if (work) {
           throw new Error(`衝突検知: タンク ${interval.tankId} は、この期間中に業務予定「${work.name}」が入っています。`);
         }
      }

      // 5. Finalize Updates (Batch Name and existing Task positions)
      await tx.batch.update({ 
        where: { id: batchId, organizationId: orgId }, 
        data: { name, color } 
      });

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Batch update conflict error:", error);
    // Return 409 for validation errors
    if (error.message.includes("衝突検知")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message
    }, { status: 500 });
  }
}


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: batchId } = await params;
    const { date: newBrewDateStr } = await req.json();
    if (!newBrewDateStr) return NextResponse.json({ error: "date is required" }, { status: 400 });

    const newBrewDate = new Date(newBrewDateStr);
    newBrewDate.setHours(0,0,0,0);

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({ 
        where: { id: batchId, organizationId: orgId },
        include: { tasks: true }
      });
      if (!batch) throw new Error("Batch not found or access denied");

      const oldBrewDate = new Date(batch.brewDate);
      oldBrewDate.setHours(0,0,0,0);
      const diffMs = newBrewDate.getTime() - oldBrewDate.getTime();

      // 1. Calculate and Validate ALL new task positions (Check against other batches' segments)
      const updatedTasks = batch.tasks.map(task => {
        const d = new Date(task.date);
        d.setHours(0,0,0,0);
        return { ...task, date: new Date(d.getTime() + diffMs) };
      });

      // Group updatedTasks by segment (tank occupancy in the SHIFTED state)
      const newIntervals: { tankId: string, start: Date, end: Date }[] = [];
      const tasksByTank: Record<string, any[]> = {};
      updatedTasks.forEach(t => {
         if (!t.tankId) return;
         if (!tasksByTank[t.tankId]) tasksByTank[t.tankId] = [];
         tasksByTank[t.tankId].push(t);
      });

      for (const tId in tasksByTank) {
         const bTasks = [...tasksByTank[tId]].sort((a,b) => (a.offsetDays || 0) - (b.offsetDays || 0));
         let segStart: Date | null = null;
         for (let i = 0; i < bTasks.length; i++) {
            const t = bTasks[i];
            if (!segStart) segStart = t.date;
            if (t.isCIP || i === bTasks.length - 1) {
               newIntervals.push({ tankId: tId, start: segStart, end: t.date });
               segStart = null;
            }
         }
      }

      const restrictedNewIntervals: { tankId: string, start: Date, end: Date }[] = [];
      for (const tId in tasksByTank) {
         const bTasks = [...tasksByTank[tId]].sort((a,b) => (a.offsetDays || 0) - (b.offsetDays || 0));
         let curSeg: any[] = [];
         for (let i = 0; i < bTasks.length; i++) {
            const t = bTasks[i];
            curSeg.push(t);
            if (t.isCIP || i === bTasks.length - 1) {
               const brewT = curSeg.find(tk => tk.offsetDays === 0);
               const moveInT = curSeg.find(tk => tk.isTankMovement && curSeg.length > 1);
               const startT = brewT || moveInT || curSeg[0];
               const endT = curSeg.find(tk => tk.isCIP) || curSeg[curSeg.length - 1];

               restrictedNewIntervals.push({ tankId: tId, start: new Date(startT.date), end: new Date(endT.date) });
               curSeg = [];
            }
         }
      }

      for (const interval of restrictedNewIntervals) {
        const otherTasks = await tx.task.findMany({
          where: { 
            tankId: interval.tankId, 
            batchId: { not: batchId },
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
          let bStart: Date | null = null;
          for (let i = 0; i < bTasks.length; i++) {
            const t = bTasks[i];
            if (!bStart) {
               const isB = t.offsetDays === 0;
               const isAr = t.isTankMovement || t.name?.includes("受入");
               if (isB || isAr) {
                 bStart = new Date(t.date);
               } else if (i === bTasks.length - 1) {
                 const firstNonPre = bTasks.find(tk => (tk.offsetDays || 0) >= 0);
                 bStart = new Date((firstNonPre || bTasks[0]).date);
               }
            }
            if (t.isCIP || i === bTasks.length - 1) {
              if (bStart) {
                const s = bStart;
                const e = new Date(t.date);
                if (interval.start <= e && interval.end >= s) {
                  const b = await tx.batch.findUnique({ where: { id: bId }, select: { name: true } });
                  throw new Error(`衝突検知: タンク ${interval.tankId} は ${s.toLocaleDateString()}〜${e.toLocaleDateString()} の間、バッチ「${b?.name || '不明'}」が占有しています。`);
                }
              }
              bStart = null;
            }
          }
        }

        const work = await tx.workSchedule.findFirst({
           where: {
              tankId: interval.tankId,
              organizationId: orgId,
              OR: [
                  { startDate: { lte: interval.end }, endDate: { gte: interval.start } }
              ]
           }
        });
        if (work) {
          throw new Error(`衝突検知: タンク ${interval.tankId} は、この期間中に業務予定「${work.name}」が入っています。`);
        }
      }

      // 2. Perform mass update
      await tx.batch.update({
        where: { id: batchId, organizationId: orgId },
        data: { brewDate: newBrewDate }
      });

      for (const t of updatedTasks) {
        await tx.task.update({
          where: { id: t.id },
          data: { date: t.date }
        });
      }

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Batch shift error:", error);
    if (error.message.includes("衝突検知")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: batchId } = await params;
    console.log(`[DELETE /api/batches/${batchId}] Deleting batch and all tasks...`);
    
    await prisma.$transaction(async (tx) => {
      // Security check
      const batch = await tx.batch.findUnique({
        where: { id: batchId, organizationId: orgId }
      });
      if (!batch) throw new Error("Batch not found or access denied");

      const taskCount = await tx.task.deleteMany({ where: { batchId } });
      console.log(`  Removed ${taskCount.count} tasks.`);
      await tx.batch.delete({ where: { id: batchId, organizationId: orgId } });
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Batch delete error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}
