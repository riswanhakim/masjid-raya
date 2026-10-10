import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/api-auth";
import { bacaTubuh, galatDatabase } from "@/lib/api-util";
import { danaSchema } from "@/lib/validasi";
import { daftarDana } from "@/lib/data-kas";
import { getServerAuth } from "@/lib/get-server-auth";

export const dynamic = "force-dynamic";

async function getHandler() {
  return NextResponse.json(await daftarDana(), { headers: { "Cache-Control": "no-store" } });
}

async function postHandler(req: NextRequest) {
  const dibaca = await bacaTubuh(req, danaSchema);
  if (!dibaca.ok) return dibaca.respons;
  const { nama, urutan } = dibaca.data;

  // Tolak nama yang hanya beda huruf besar-kecil dari dana yang sudah ada.
  const semua = await prisma.dana.findMany({ select: { nama: true } });
  const kembar = semua.find((d) => d.nama.toLowerCase() === nama.toLowerCase());
  if (kembar) {
    return NextResponse.json({ error: `Dana "${kembar.nama}" sudah ada. Aktifkan kembali bila sedang nonaktif.` }, { status: 409 });
  }

  try {
    const { user } = await getServerAuth();
    const dana = await prisma.$transaction(async (tx) => {
      const baris = await tx.dana.create({ data: { nama, urutan: urutan ?? semua.length + 1 } });
      await tx.auditLog.create({ data: { actorId: user!.id!, entity: "dana", entityId: baris.id, action: "create", after: JSON.stringify(baris) } });
      return baris;
    });
    return NextResponse.json(dana, { status: 201 });
  } catch (error) {
    return galatDatabase(error, "Gagal menambah dana");
  }
}

export const GET = withAdminAuth(getHandler, ["admin", "bendahara"]);
export const POST = withAdminAuth(postHandler, ["admin", "bendahara"]);
