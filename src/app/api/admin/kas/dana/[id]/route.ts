import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth, type KonteksRute } from "@/lib/api-auth";
import { bacaTubuh, galatDatabase, tidakDitemukan } from "@/lib/api-util";
import { danaUbahSchema } from "@/lib/validasi";
import { getServerAuth } from "@/lib/get-server-auth";

export const dynamic = "force-dynamic";

/**
 * Nama dana tidak bisa diganti karena transaksi menyimpan namanya. Dana yang
 * tidak dipakai lagi dinonaktifkan: hilang dari pilihan pencatatan, tetapi
 * transaksi lamanya tetap terhitung di laporan.
 */
async function patchHandler(req: NextRequest, { params }: KonteksRute<{ id: string }>) {
  const { id } = await params;
  const dibaca = await bacaTubuh(req, danaUbahSchema);
  if (!dibaca.ok) return dibaca.respons;
  const before = await prisma.dana.findUnique({ where: { id } });
  if (!before) return tidakDitemukan();
  try {
    const { user } = await getServerAuth();
    const after = await prisma.$transaction(async (tx) => {
      const baris = await tx.dana.update({ where: { id }, data: dibaca.data });
      await tx.auditLog.create({ data: { actorId: user!.id!, entity: "dana", entityId: id, action: "update", before: JSON.stringify(before), after: JSON.stringify(baris) } });
      return baris;
    });
    return NextResponse.json(after);
  } catch (error) {
    return galatDatabase(error, "Gagal memperbarui dana");
  }
}

export const PATCH = withAdminAuth(patchHandler, ["admin", "bendahara"]);
