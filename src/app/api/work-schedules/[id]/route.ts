import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// DELETE /api/work-schedules/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.workSchedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete work schedule" }, { status: 500 });
  }
}

// PATCH /api/work-schedules/[id] — shift by daysDelta
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { daysDelta } = await req.json();
    const ws = await prisma.workSchedule.findUnique({ where: { id } });
    if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const newStart = new Date(ws.startDate.getTime() + daysDelta * 86400000);
    const newEnd = ws.endDate ? new Date(ws.endDate.getTime() + daysDelta * 86400000) : null;

    await prisma.workSchedule.update({
      where: { id },
      data: { startDate: newStart, endDate: newEnd },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update work schedule" }, { status: 500 });
  }
}
