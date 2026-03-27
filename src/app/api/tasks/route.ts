import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getOrgAuth } from "@/lib/auth-sync";

export const dynamic = "force-dynamic";

// POST /api/tasks — add a task to an existing batch
export async function POST(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, date, batchId, tankId, offsetDays: providedOffset } = await req.json();
    const taskDate = new Date(date);
    
    // 1. Fetch batch to find its brew date - SECURITY CHECK: Must match organizationId
    const batch = await prisma.batch.findUnique({ 
      where: { id: batchId, organizationId: orgId } 
    });
    if (!batch) return NextResponse.json({ error: "Batch not found or access denied" }, { status: 404 });

    // 2. Calculate offset from brewDate if not provided
    const calculatedOffset = providedOffset ?? Math.floor((taskDate.getTime() - batch.brewDate.getTime()) / 86400000);

    const task = await prisma.task.create({
      data: {
        name,
        date: taskDate,
        batchId,
        tankId: tankId || null,
        offsetDays: calculatedOffset,
        isTankMovement: (name || "").includes("移送") || (name || "").includes("受入"),
        isCIP: (name || "").includes("CIP") || (name || "").includes("洗浄"),
      },
    });
    return NextResponse.json(task);
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
