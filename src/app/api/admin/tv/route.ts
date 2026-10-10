import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/api-auth";
import { getServerAuth } from "@/lib/get-server-auth";
import { dataSlide, slideSchema } from "@/lib/tv";
import { bacaTubuh, galatDatabase } from "@/lib/api-util";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async () =>
  NextResponse.json(await prisma.tvSlide.findMany({ orderBy: [{ urutan: "asc" }, { createdAt: "asc" }] }), { headers: { "Cache-Control": "no-store" } })
);

export const POST = withAdminAuth(async (req: NextRequest) => {
  const parsed = await bacaTubuh(req, slideSchema);
  if (!parsed.ok) return parsed.respons;
  const { user } = await getServerAuth();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const result = await tx.tvSlide.create({ data: dataSlide(parsed.data) });
      await tx.auditLog.create({ data: { actorId: user!.id!, entity: "tv", entityId: result.id, action: "create", after: JSON.stringify(result) } });
      return result;
    });
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return galatDatabase(error, "Gagal menyimpan tayangan");
  }
});
