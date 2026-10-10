import type { Metadata } from "next";
import Link from "next/link";
import { KepalaAdmin } from "@/components/admin/AdminShell";
import FormPublikasiKas from "@/components/admin/kas/FormPublikasiKas";
import { daftarDana, ringkasanKasPublik } from "@/lib/data-kas";
import { getPetaPengaturan } from "@/lib/settings";
import { formatRupiah } from "@/lib/format";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Publikasi Kas" };

export default async function HalamanPublikasi() {
  const [pengaturan, dana, ringkasan, slideKas] = await Promise.all([
    getPetaPengaturan(),
    daftarDana(),
    ringkasanKasPublik(),
    prisma.tvSlide.count({ where: { jenis: "kas", aktif: true, selesai: { gt: new Date() } } }),
  ]);

  return (
    <div className="max-w-3xl">
      <KepalaAdmin
        kicker="Keuangan"
        judul="Publikasi Kas ke Jamaah"
        keterangan="Atur ringkasan kas yang boleh dilihat jamaah di halaman Laporan Kas dan di layar TV. Yang dipublikasikan hanya angka ringkasan: tanpa keterangan transaksi, bukti, nama pencatat, atau identitas donatur."
        aksi={<Link href="/admin/kas" className="btn btn-outline min-h-11">Kembali ke buku kas</Link>}
      />

      <FormPublikasiKas
        awal={{
          aktif: pengaturan.kas_publik === "true",
          periode: pengaturan.kas_publik_periode,
          dana: pengaturan.kas_publik_dana.split("\n").filter(Boolean),
        }}
        semuaDana={dana.map((d) => d.nama)}
      />

      <section className="mt-10">
        <h2 className="section-title">Yang sedang dilihat jamaah</h2>
        {ringkasan ? (
          <div className="surface mt-4 p-5 text-sm">
            <p className="text-ink-500">{ringkasan.periode}</p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-4">
              {ringkasan.dari && <div><dt className="meta">Saldo awal</dt><dd className="font-semibold tabular-nums">{formatRupiah(ringkasan.saldoAwal)}</dd></div>}
              <div><dt className="meta">Pemasukan</dt><dd className="font-semibold tabular-nums">{formatRupiah(ringkasan.masuk)}</dd></div>
              <div><dt className="meta">Pengeluaran</dt><dd className="font-semibold tabular-nums">{formatRupiah(ringkasan.keluar)}</dd></div>
              <div><dt className="meta">Saldo akhir</dt><dd className="font-semibold tabular-nums">{formatRupiah(ringkasan.saldoAkhir)}</dd></div>
            </dl>
            <p className="meta mt-4">
              {slideKas > 0
                ? "Ada slide ringkasan kas aktif, jadi angka ini juga tampil di TV."
                : <>Belum ada slide ringkasan kas di TV. <Link className="link-hairline" href="/admin/tayangan/tambah?jenis=kas">Buat slide kas</Link> bila ingin menampilkannya di layar.</>}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-500">Publikasi mati. Halaman Laporan Kas hanya menampilkan pesan bahwa ringkasan belum dipublikasikan, dan slide kas tidak tampil di TV.</p>
        )}
      </section>
    </div>
  );
}
