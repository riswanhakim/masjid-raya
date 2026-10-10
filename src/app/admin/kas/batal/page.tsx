import type { Metadata } from "next";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { KepalaAdmin } from "@/components/admin/AdminShell";
import { formatRupiah } from "@/lib/format";
import { zonaMasjid } from "@/lib/data-kas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transaksi Dibatalkan" };

/** Transaksi yang dibatalkan: tidak dihitung, tetapi tetap bisa ditelusuri. */
export default async function HalamanBatal() {
  const [baris, zona] = await Promise.all([
    prisma.kasTransaksi.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 200 }),
    zonaMasjid(),
  ]);
  const alasan = new Map(
    (await prisma.auditLog.findMany({ where: { entity: "kas", action: "void", entityId: { in: baris.map((b) => b.id) } }, select: { entityId: true, alasan: true } }))
      .map((a) => [a.entityId, a.alasan])
  );
  const waktu = new Intl.DateTimeFormat("id-ID", { timeZone: zona, dateStyle: "medium", timeStyle: "short" });
  const tgl = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="max-w-4xl">
      <KepalaAdmin
        kicker="Keuangan"
        judul="Transaksi Dibatalkan"
        keterangan="Transaksi ini tidak dihitung dalam saldo. Catatan dan alasannya disimpan untuk pemeriksaan."
        aksi={<Link href="/admin/kas" className="btn btn-outline min-h-11">Kembali ke buku kas</Link>}
      />
      {baris.length === 0 ? (
        <p className="mt-8 text-sm text-ink-500">Belum ada transaksi yang dibatalkan.</p>
      ) : (
        <ul className="surface mt-8 divide-y divide-forest-900/10">
          {baris.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium text-forest-900 [overflow-wrap:anywhere]">{b.keterangan}</p>
                <p className="meta mt-1">
                  {tgl.format(b.tanggal)} · {b.jenis === "masuk" ? "Pemasukan" : "Pengeluaran"} {formatRupiah(b.jumlah)} · {b.dana}
                </p>
                <p className="mt-1 text-sm text-ink-500">
                  Dibatalkan {waktu.format(b.deletedAt!)}{alasan.get(b.id) ? `. Alasan: ${alasan.get(b.id)}` : ""}
                </p>
              </div>
              <Link href={`/admin/kas/${b.id}/riwayat`} className="inline-flex min-h-11 items-center text-sm text-forest-700">Riwayat</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
