import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrgAuth } from "@/lib/auth-sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    const { name, description, startDate, endDate, isRecurring, recurringDay, recurringUntil, tankId, userId } = data;

    const workSchedule = await prisma.workSchedule.create({
      data: {
        name,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isRecurring,
        recurringDay,
        recurringUntil: recurringUntil ? new Date(recurringUntil) : null,
        tankId,
        userId: userId || null, // Optional tracking of who created it
        organizationId: orgId,
      },
    });

    return NextResponse.json(workSchedule);
  } catch (error) {
    console.error("Failed to create work schedule:", error);
    return NextResponse.json({ error: "Failed to create work schedule" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    const { id, name, description, startDate, endDate, isRecurring, recurringDay, recurringUntil, tankId } = data;

    const workSchedule = await prisma.workSchedule.update({
      where: { id, organizationId: orgId },
      data: {
        name,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isRecurring,
        recurringDay,
        recurringUntil: recurringUntil ? new Date(recurringUntil) : null,
        tankId,
      },
    });

    return NextResponse.json(workSchedule);
  } catch (error) {
    console.error("Failed to update work schedule:", error);
    return NextResponse.json({ error: "Failed to update work schedule" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workSchedules = await prisma.workSchedule.findMany({
      where: { organizationId: orgId },
      include: { tank: true },
    });
    return NextResponse.json(workSchedules);
  } catch (error) {
    console.error("Failed to fetch work schedules:", error);
    return NextResponse.json({ error: "Failed to fetch work schedules" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    await prisma.workSchedule.delete({ 
      where: { id, organizationId: orgId } 
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete work schedule:", error);
    return NextResponse.json({ error: "Failed to delete work schedule" }, { status: 500 });
  }
}
