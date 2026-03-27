import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getOrgAuth } from "@/lib/auth-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const templates = await prisma.template.findMany({
      where: { organizationId: orgId },
      include: { tasks: true },
    });
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, description, tasks } = await req.json();

    const template = await prisma.template.create({
      data: {
        name,
        description,
        organizationId: orgId,
        tasks: {
          create: tasks.map((t: any) => ({
            name: t.name,
            offsetDays: t.offsetDays,
            isTankMovement: t.isTankMovement || false,
            isCIP: t.isCIP || false,
          })),
        },
      },
      include: { tasks: true },
    });
    return NextResponse.json(template);
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, name, description, tasks } = await req.json();
    
    // Security check
    const existing = await prisma.template.findUnique({
      where: { id, organizationId: orgId }
    });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // Use transaction to ensure deletions and creation are atomic
    await prisma.$transaction([
      prisma.templateTask.deleteMany({ where: { templateId: id } }),
      prisma.template.update({
        where: { id, organizationId: orgId },
        data: {
          name,
          description,
          tasks: {
            create: tasks.map((t: any) => ({
              name: t.name,
              offsetDays: t.offsetDays,
              isTankMovement: t.isTankMovement || false,
              isCIP: t.isCIP || false,
            })),
          },
        },
      }),
    ]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const orgId = await getOrgAuth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    
    // Check if any batches are using this template (within the same organization)
    const batchCount = await prisma.batch.count({
      where: { templateId: id, organizationId: orgId }
    });
    
    if (batchCount > 0) {
      return NextResponse.json(
        { error: "このテンプレートは使用中のバッチがあるため削除できません。" },
        { status: 400 }
      );
    }

    await prisma.template.delete({
      where: { id, organizationId: orgId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
