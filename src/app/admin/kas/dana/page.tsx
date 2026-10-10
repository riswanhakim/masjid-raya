import type { Metadata } from "next";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { KepalaAdmin } from "@/components/admin/AdminShell";
import KelolaDana from "@/components/admin/kas/KelolaDana";
import { daftarDana } from "@/lib/data-kas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kelola Dana" };

export default async function HalamanDana() {
  const [dana, pakai] = await Promise.all([
    daftarDana(),
    prisma.kasTransaksi.groupBy({ by: ["dana"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  const jumlah = new Map(pakai.map((p) => [p.dana, p._count._all]));
  return (
    <div className="max-w-3xl">
      <KepalaAdmin
        kicker="Keuangan"
        judul="Kelola Dana"
        keterangan="Dana memisahkan uang menurut peruntukannya. Nama dana tidak bisa diganti setelah dibuat agar transaksi lama tetap cocok; dana yang tidak dipakai lagi cukup dinonaktifkan."
        aksi={<Link href="/admin/kas" className="btn btn-outline min-h-11">Kembali ke buku kas</Link>}
      />
      <KelolaDana awal={dana.map((d) => ({ id: d.id, nama: d.nama, aktif: d.aktif, transaksi: jumlah.get(d.nama) ?? 0 }))} />
    </div>
  );
}
