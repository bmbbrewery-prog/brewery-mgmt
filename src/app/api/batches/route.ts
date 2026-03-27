import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getOrgAuth } from "@/lib/auth-sync";

export async function GET() {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized or no organization selected" }, { status: 401 });
    }

    const tanks = await prisma.tank.findMany({
      where: { organizationId: orgId }
    });
    const templates = await prisma.template.findMany({
      where: { organizationId: orgId },
      include: { tasks: true },
    });
    const batches = await prisma.batch.findMany({
      where: { organizationId: orgId },
      include: { tasks: true, template: true, mainTank: true },
    });
    const workSchedules = await prisma.workSchedule.findMany({
      where: { organizationId: orgId },
      include: { tank: true },
    });

    return NextResponse.json({ tanks, templates, batches, workSchedules });
  } catch (error) {
    console.error("API Error (GET /api/batches):", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, templateId, brewDate, tankId, color } = body;

    console.log("POST /api/batches - Received body:", body);

    if (!name || !templateId || !brewDate || !tankId) {
      console.warn("POST /api/batches - Missing required fields");
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const brewDateParsed = new Date(brewDate);
    if (isNaN(brewDateParsed.getTime())) {
      console.warn("POST /api/batches - Invalid brewDate:", brewDate);
      return NextResponse.json({ error: "Invalid brewDate" }, { status: 400 });
    }
    
    const template = await prisma.template.findUnique({
      where: { id: templateId, organizationId: orgId },
      include: { tasks: true },
    });

    if (!template) {
      console.warn("POST /api/batches - Template not found:", templateId);
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // 1. Calculate occupancy intervals BEFORE creating anything
    const selectedTankIds = Array.isArray(body.tankIds) ? body.tankIds : [tankId];
    const sortedTemplateTasks = [...template.tasks].sort((a,b) => {
      if (a.offsetDays !== b.offsetDays) return (a.offsetDays || 0) - (b.offsetDays || 0);
      if (a.isTankMovement && !b.isTankMovement) return -1;
      if (!a.isTankMovement && b.isTankMovement) return 1;
      return 0;
    });

    const intervals: { tankId: string, start: Date, end: Date }[] = [];
    let intervalTankIdx = 0;
    let currentSegmentTasks: any[] = [];

    for (let i = 0; i < sortedTemplateTasks.length; i++) {
        const t = sortedTemplateTasks[i];
        const taskDate = new Date(brewDateParsed.getTime() + (Number(t.offsetDays) || 0) * 24 * 60 * 60 * 1000);
        currentSegmentTasks.push({ ...t, date: taskDate });

        if (t.isCIP || i === sortedTemplateTasks.length - 1) {
            const startT = currentSegmentTasks[0];
            const endT = currentSegmentTasks[currentSegmentTasks.length - 1];

            const currentId = selectedTankIds[intervalTankIdx] || selectedTankIds[selectedTankIds.length - 1];
            intervals.push({ 
              tankId: currentId, 
              start: new Date(startT.date), 
              end: new Date(endT.date) 
            });
            
            intervalTankIdx++;
            currentSegmentTasks = [];
        }
    }

    // RE-BUILD RESTRICTED INTERVALS FOR VALIDATION
    const restrictedIntervals: { tankId: string, start: Date, end: Date }[] = [];
    let rIdx = 0;
    let rSeg: any[] = [];
    for (let i = 0; i < sortedTemplateTasks.length; i++) {
        const t = sortedTemplateTasks[i];
        const d = new Date(brewDateParsed.getTime() + (Number(t.offsetDays) || 0) * 86400000);
        rSeg.push({ ...t, date: d });
        if (t.isCIP || i === sortedTemplateTasks.length - 1) {
            const bT = rSeg.find(tk => tk.offsetDays === 0);
            const mInT = rSeg.find(tk => tk.isTankMovement && i > 0);
            const startT = bT || mInT || rSeg[0];
            const endT = rSeg.find(tk => tk.isCIP) || rSeg[rSeg.length - 1];

            const tId = selectedTankIds[rIdx] || selectedTankIds[selectedTankIds.length - 1];
            restrictedIntervals.push({ tankId: tId, start: new Date(startT.date), end: new Date(endT.date) });
            rIdx++;
            rSeg = [];
        }
    }

    for (const interval of restrictedIntervals) {
        const existingTasks = await prisma.task.findMany({
            where: { 
              tankId: interval.tankId,
              batch: { organizationId: orgId } // Only check conflicts within the same organization
            },
            orderBy: { date: 'asc' }
        });

        const batchMap: Record<string, any[]> = {};
        existingTasks.forEach(et => {
            if (!batchMap[et.batchId]) batchMap[et.batchId] = [];
            batchMap[et.batchId].push(et);
        });

        for (const bId in batchMap) {
            const bTasks = [...batchMap[bId]].sort((a,b) => (a.offsetDays || 0) - (b.offsetDays || 0));
            let bOccStart: Date | null = null;
            for (let j = 0; j < bTasks.length; j++) {
                const et = bTasks[j];
                if (!bOccStart) {
                   const isB = et.offsetDays === 0;
                   const isAr = et.isTankMovement || et.name?.includes("受入");
                   if (isB || isAr) {
                     bOccStart = new Date(et.date);
                   } else if (j === bTasks.length - 1) {
                     const firstNonPre = bTasks.find(tk => (tk.offsetDays || 0) >= 0);
                     bOccStart = new Date((firstNonPre || bTasks[0]).date);
                   }
                }
                
                if (et.isCIP || j === bTasks.length - 1) {
                    if (bOccStart) {
                        const s = bOccStart;
                        const e = new Date(et.date);
                        if (interval.start <= e && interval.end >= s) {
                            const b = await prisma.batch.findUnique({ where: { id: bId }, select: { name: true } });
                            return NextResponse.json({ 
                                error: `衝突検知: タンク は ${s.toLocaleDateString()}〜${e.toLocaleDateString()} の間、バッチ「${b?.name || '不明'}」が占有しています。` 
                            }, { status: 409 });
                        }
                    }
                    bOccStart = null;
                }
            }
        }

        const work = await prisma.workSchedule.findFirst({
            where: {
                tankId: interval.tankId,
                organizationId: orgId,
                OR: [{ startDate: { lte: interval.end }, endDate: { gte: interval.start } }]
            }
        });
        if (work) {
            return NextResponse.json({ error: `衝突検知: タンク はこの期間中に業務予定「${work.name}」が入っています。` }, { status: 409 });
        }
    }

    // 3. Everything clear, create batch and tasks
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          name,
          templateId,
          brewDate: brewDateParsed,
          organizationId: orgId,
          mainTankId: tankId,
          color: color || null,
        },
      });

      const tasksData: any[] = [];
      let currentTankIdx = 0;
      
      sortedTemplateTasks.forEach((t) => {
        const currentTankId = selectedTankIds[currentTankIdx] || selectedTankIds[selectedTankIds.length - 1];
        const taskDate = new Date(brewDateParsed.getTime() + (Number(t.offsetDays) || 0) * 24 * 60 * 60 * 1000);

        tasksData.push({
          name: t.name,
          date: taskDate,
          batchId: batch.id,
          tankId: currentTankId,
          offsetDays: Number(t.offsetDays) || 0,
          isTankMovement: !!t.isTankMovement,
          isCIP: !!t.isCIP,
        });

        if (t.isTankMovement) {
          const nextTankId = selectedTankIds[currentTankIdx + 1];
          if (nextTankId && nextTankId !== currentTankId) {
            tasksData.push({
              name: `${t.name} (受入)`,
              date: taskDate,
              batchId: batch.id,
              tankId: nextTankId,
              offsetDays: Number(t.offsetDays) || 0,
              isTankMovement: true,
              isCIP: false,
            });
          }
        }

        if (t.isCIP && currentTankIdx < selectedTankIds.length - 1) {
          currentTankIdx++;
        }
      });

      await tx.task.createMany({ data: tasksData });
      return batch;
    });

    console.log("POST /api/batches - Created batch and tasks:", result.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API Error (POST /api/batches):", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
