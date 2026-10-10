import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/api-auth";
import { bacaTubuh, galatDatabase, tanggalKeDate } from "@/lib/api-util";
import { kasBuatSchema } from "@/lib/validasi";
import { createTransaction } from "@/lib/finance";
import { getServerAuth } from "@/lib/get-server-auth";
import { danaResmi } from "@/lib/data-kas";

export const dynamic = "force-dynamic";

async function getHandler() {
  const transaksi = await prisma.kasTransaksi.findMany({
    where: { deletedAt: null },
    orderBy: { tanggal: "desc" },
  });
  return NextResponse.json(transaksi, { headers: { "Cache-Control": "no-store" } });
}

async function postHandler(req: NextRequest) {
  const dibaca = await bacaTubuh(req, kasBuatSchema);
  if (!dibaca.ok) return dibaca.respons;

  const d = dibaca.data;
  const dana = await danaResmi(d.dana);
  if (!dana) {
    return NextResponse.json({ error: `Dana "${d.dana}" tidak ada di daftar dana aktif` }, { status: 400 });
  }

  try {
    const { user } = await getServerAuth();
    const transaksi = await prisma.$transaction((tx) => createTransaction(tx, {
        tanggal: tanggalKeDate(d.tanggal),
        jenis: d.jenis,
        kategori: d.kategori ?? null,
        keterangan: d.keterangan,
        jumlah: d.jumlah,
        dana,
        bukti: d.bukti,
      }, user!.id!));
    return NextResponse.json(transaksi, { status: 201 });
  } catch (error) {
    return galatDatabase(error, "Gagal menambah transaksi kas");
  }
}

// Buku kas hanya untuk admin dan bendahara.
export const GET = withAdminAuth(getHandler, ["admin", "bendahara"]);
export const POST = withAdminAuth(postHandler, ["admin", "bendahara"]);
