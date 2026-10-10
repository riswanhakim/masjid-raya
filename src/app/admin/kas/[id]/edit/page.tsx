import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import FormKas from "@/components/admin/FormKas";
import { daftarDana, daftarKategori } from "@/lib/data-kas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Koreksi Transaksi" };

export default async function Halaman({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, dana, kategori] = await Promise.all([
    prisma.kasTransaksi.findFirst({ where: { id, deletedAt: null } }),
    daftarDana(true),
    daftarKategori(),
  ]);
  if (!t) notFound();

  return (
    <FormKas
      id={id}
      dana={dana.map((d) => d.nama)}
      kategori={kategori}
      awal={{
        tanggal: t.tanggal.toISOString().slice(0, 10),
        jenis: t.jenis === "keluar" ? "keluar" : "masuk",
        kategori: t.kategori ?? "",
        keterangan: t.keterangan,
        jumlah: String(t.jumlah),
        dana: t.dana,
        bukti: t.bukti,
      }}
    />
  );
}
