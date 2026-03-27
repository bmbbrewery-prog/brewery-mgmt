import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getOrgAuth } from "@/lib/auth-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tanks = await prisma.tank.findMany({ 
      where: { organizationId: orgId },
      orderBy: { sortOrder: 'asc' } 
    });
    return NextResponse.json(tanks);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, type, capacity, category, color } = body;
    
    const maxSort = await prisma.tank.aggregate({ 
      where: { organizationId: orgId },
      _max: { sortOrder: true } 
    });
    const nextSort = (maxSort?._max?.sortOrder || 0) + 1;

    const tank = await prisma.tank.create({
      data: {
        name,
        type: type || null,
        capacity: (capacity !== undefined && capacity !== null) ? Number(capacity) : null,
        category: category || "TANK",
        sortOrder: nextSort,
        color: color || null,
        organizationId: orgId,
      },
    });

    return NextResponse.json(tank);
  } catch (error) {
    console.error("Failed to create tank/column:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reorder } = await req.json();
    if (!Array.isArray(reorder)) {
      return NextResponse.json({ error: "reorder must be an array" }, { status: 400 });
    }

    await prisma.$transaction(
      reorder.map((item: { id: string, sortOrder: number }) => 
        prisma.tank.update({
          where: { id: item.id, organizationId: orgId },
          data: { sortOrder: item.sortOrder }
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder tanks:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, name, type, capacity, category, color } = body;
    
    if (!id) {
      return NextResponse.json({ error: "Missing ID for update" }, { status: 400 });
    }

    const tank = await prisma.tank.update({
      where: { id, organizationId: orgId },
      data: { 
        name, 
        type: type !== undefined ? (type || null) : undefined,
        capacity: capacity !== undefined ? (Number(capacity) || null) : undefined,
        category: category !== undefined ? category : undefined,
        color: color !== undefined ? (color || null) : undefined
      },
    });
    return NextResponse.json(tank);
  } catch (error) {
    console.error("Failed to update tank:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    
    await prisma.$transaction(async (tx) => {
      // Security check: Ensure the tank belongs to the organization
      const tank = await tx.tank.findUnique({
        where: { id, organizationId: orgId }
      });
      if (!tank) throw new Error("Tank not found or access denied");

      // 1. Delete all tasks associated with this tank
      await tx.task.deleteMany({
        where: { tankId: id }
      });

      // 2. Delete all work schedules associated with this tank
      await tx.workSchedule.deleteMany({
        where: { tankId: id, organizationId: orgId }
      });

      // 3. Find batches that now have zero tasks and delete them
      // Note: This logic only affects batches within the same organization
      const batchesWithNoTasks = await tx.batch.findMany({
        where: {
          organizationId: orgId,
          tasks: { none: {} }
        }
      });
      
      if (batchesWithNoTasks.length > 0) {
        await tx.batch.deleteMany({
          where: {
            organizationId: orgId,
            id: { in: batchesWithNoTasks.map(b => b.id) }
          }
        });
      }

      // 4. Delete the tank itself
      await tx.tank.delete({
        where: { id, organizationId: orgId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tank delete error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
