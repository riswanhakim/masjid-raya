import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { withAdminAuth, type KonteksRute } from "@/lib/api-auth";
import { getServerAuth } from "@/lib/get-server-auth";
import { dataSlide, slideSchema } from "@/lib/tv";
import { bacaTubuh, galatDatabase, tidakDitemukan } from "@/lib/api-util";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (_req: NextRequest, ctx: KonteksRute<{ id: string }>) => {
  const { id } = await ctx.params;
  const row = await prisma.tvSlide.findUnique({ where: { id } });
  return row ? NextResponse.json(row, { headers: { "Cache-Control": "no-store" } }) : tidakDitemukan();
});

async function simpanPerubahan(id: string, data: Parameters<typeof prisma.tvSlide.update>[0]["data"], action: string) {
  const { user } = await getServerAuth();
  const before = await prisma.tvSlide.findUnique({ where: { id } });
  if (!before) return tidakDitemukan();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const after = await tx.tvSlide.update({ where: { id }, data });
      await tx.auditLog.create({ data: { actorId: user!.id!, entity: "tv", entityId: id, action, before: JSON.stringify(before), after: JSON.stringify(after) } });
      return after;
    });
    return NextResponse.json(row);
  } catch (error) {
    return galatDatabase(error, "Gagal menyimpan tayangan");
  }
}

export const PUT = withAdminAuth(async (req: NextRequest, ctx: KonteksRute<{ id: string }>) => {
  const { id } = await ctx.params;
  const parsed = await bacaTubuh(req, slideSchema);
  if (!parsed.ok) return parsed.respons;
  return simpanPerubahan(id, dataSlide(parsed.data), "update");
});

/** Nonaktifkan/aktifkan tanpa menghapus; perubahan tercatat di audit. */
export const PATCH = withAdminAuth(async (req: NextRequest, ctx: KonteksRute<{ id: string }>) => {
  const { id } = await ctx.params;
  const parsed = await bacaTubuh(req, z.strictObject({ aktif: z.boolean() }));
  if (!parsed.ok) return parsed.respons;
  return simpanPerubahan(id, { aktif: parsed.data.aktif }, parsed.data.aktif ? "activate" : "deactivate");
});
