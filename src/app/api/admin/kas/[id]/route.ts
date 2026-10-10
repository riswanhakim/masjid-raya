import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth, type KonteksRute } from "@/lib/api-auth";
import {
  bacaTubuh,
  galatDatabase,
  tidakDitemukan,
  tanggalKeDate,
} from "@/lib/api-util";
import { kasBatalSchema, kasUbahSchema } from "@/lib/validasi";
import { changeTransaction } from "@/lib/finance";
import { danaResmi } from "@/lib/data-kas";
import { getServerAuth } from "@/lib/get-server-auth";

export const dynamic = "force-dynamic";

async function getHandler(_req: NextRequest, { params }: KonteksRute<{ id: string }>) {
  const { id } = await params;
  const transaksi = await prisma.kasTransaksi.findFirst({ where: { id, deletedAt: null } });
  if (!transaksi) return tidakDitemukan();
  return NextResponse.json(transaksi, { headers: { "Cache-Control": "no-store" } });
}

async function putHandler(req: NextRequest, { params }: KonteksRute<{ id: string }>) {
  const { id } = await params;
  const dibaca = await bacaTubuh(req, kasUbahSchema);
  if (!dibaca.ok) return dibaca.respons;

  const { alasan, ...d } = dibaca.data;

  if (Object.keys(d).length === 0) {
    return NextResponse.json(
      { error: "Tidak ada kolom yang dikirim untuk diperbarui" },
      { status: 400 }
    );
  }

  // Dana yang sudah dinonaktifkan tetap boleh dipertahankan saat koreksi;
  // hanya perpindahan ke dana lain yang wajib ke dana aktif.
  let dana: string | undefined;
  const lama = await prisma.kasTransaksi.findUnique({ where: { id }, select: { dana: true } });
  if (d.dana !== undefined && d.dana !== lama?.dana) {
    const resmi = await danaResmi(d.dana);
    if (!resmi) return NextResponse.json({ error: `Dana "${d.dana}" tidak ada di daftar dana aktif` }, { status: 400 });
    dana = resmi;
  }

  try {
    const { user } = await getServerAuth();
    const transaksi = await changeTransaction(id, {
        ...(d.tanggal !== undefined ? { tanggal: tanggalKeDate(d.tanggal) } : {}),
        ...(d.jenis !== undefined ? { jenis: d.jenis } : {}),
        ...(d.kategori !== undefined ? { kategori: d.kategori } : {}),
        ...(d.keterangan !== undefined ? { keterangan: d.keterangan } : {}),
        ...(d.jumlah !== undefined ? { jumlah: d.jumlah } : {}),
        ...(dana !== undefined ? { dana } : {}),
        ...(d.bukti !== undefined ? { bukti: d.bukti } : {}),
      }, user!.id!, alasan);
    return NextResponse.json(transaksi);
  } catch (error) {
    return galatDatabase(error, "Gagal memperbarui transaksi kas");
  }
}

/** Pembatalan: transaksi keluar dari perhitungan, riwayatnya tetap ada. */
async function deleteHandler(req: NextRequest, { params }: KonteksRute<{ id: string }>) {
  const { id } = await params;
  const dibaca = await bacaTubuh(req, kasBatalSchema);
  if (!dibaca.ok) return dibaca.respons;
  try {
    const { user } = await getServerAuth();
    await changeTransaction(id, null, user!.id!, dibaca.data.alasan);
    return NextResponse.json({ success: true });
  } catch (error) {
    return galatDatabase(error, "Gagal membatalkan transaksi kas");
  }
}

export const GET = withAdminAuth(getHandler, ["admin", "bendahara"]);
export const PUT = withAdminAuth(putHandler, ["admin", "bendahara"]);
export const DELETE = withAdminAuth(deleteHandler, ["admin", "bendahara"]);
