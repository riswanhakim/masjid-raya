import type { Metadata } from "next";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { KepalaAdmin, TautanAksi } from "@/components/admin/AdminShell";
import SlideTayangan from "@/components/tv/SlideTayangan";
import TombolAktifSlide from "@/components/admin/tayangan/TombolAktifSlide";
import { IkonTambah } from "@/components/Ikon";
import { ringkasanKasPublik, zonaMasjid } from "@/lib/data-kas";
import { LABEL_JENIS, LABEL_STATUS, SINGKATAN_ZONA, statusSlide, type JenisSlide, type StatusSlide } from "@/lib/tv";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tayangan TV" };

const URUTAN_KELOMPOK: { status: StatusSlide; keterangan: string }[] = [
  { status: "tayang", keterangan: "Diputar bergantian di TV sesuai urutan. Saat adzan dan iqomah, tayangan berhenti dan layar menampilkan waktu shalat." },
  { status: "dijadwalkan", keterangan: "Akan muncul otomatis saat masa tayangnya tiba." },
  { status: "kedaluwarsa", keterangan: "Masa tayang sudah lewat. Edit akhir tayang untuk menayangkannya lagi." },
  { status: "nonaktif", keterangan: "Disembunyikan dari TV oleh pengurus. Riwayat perubahannya tetap tersimpan." },
];

/**
 * Pertanyaan utama layar ini: apa yang sedang tampil di TV sekarang, dan apa
 * yang akan menyusul. Karena itu daftar dikelompokkan per status, dan setiap
 * slide diberi pratinjau yang dirender oleh komponen yang sama dengan TV.
 */
export default async function HalamanTayangan() {
  const [slides, kas, zona] = await Promise.all([
    prisma.tvSlide.findMany({ orderBy: [{ urutan: "asc" }, { createdAt: "asc" }] }),
    ringkasanKasPublik(),
    zonaMasjid(),
  ]);
  const now = new Date();
  const zonaSingkat = SINGKATAN_ZONA[zona] ?? "";
  const waktu = new Intl.DateTimeFormat("id-ID", { timeZone: zona, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const kelompok = new Map<StatusSlide, typeof slides>();
  for (const s of slides) {
    const st = statusSlide(s, now);
    kelompok.set(st, [...(kelompok.get(st) ?? []), s]);
  }
  const tayang = (kelompok.get("tayang") ?? []).filter((s) => s.jenis !== "kas" || kas);
  const putaran = tayang.reduce((t, s) => t + s.durasi, 0);

  return (
    <div>
      <KepalaAdmin
        kicker="Layar TV"
        judul="Tayangan TV"
        keterangan={
          tayang.length
            ? `${tayang.length} slide sedang tayang, satu putaran sekitar ${putaran} detik. Perubahan terlihat di TV paling lambat satu menit setelah disimpan.`
            : "Belum ada slide yang sedang tayang. Tanpa slide, TV menampilkan ayat pilihan dan jadwal shalat."
        }
        aksi={
          <>
            <TautanAksi href="/admin/tayangan/tambah"><IkonTambah className="h-4 w-4" />Buat tayangan</TautanAksi>
            <Link href="/" target="_blank" className="btn btn-outline min-h-11">Buka layar TV</Link>
          </>
        }
      />

      {slides.length === 0 && (
        <div className="surface mt-8 p-6">
          <p className="text-sm text-ink-500">Belum ada tayangan. Buat kajian, pengumuman, atau foto galeri pertama untuk mulai mengisi layar TV.</p>
          <Link href="/admin/tayangan/tambah" className="btn btn-primary mt-4 min-h-11">Buat tayangan</Link>
        </div>
      )}

      {URUTAN_KELOMPOK.map(({ status, keterangan }) => {
        const daftar = kelompok.get(status) ?? [];
        if (daftar.length === 0) return null;
        const ringkas = status === "kedaluwarsa" || status === "nonaktif";
        const isi = (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {daftar.map((s) => (
              <li key={s.id} className="surface flex flex-col overflow-hidden">
                <div className="bg-paper-100 p-2">
                  <div className="aspect-video overflow-hidden">
                    <SlideTayangan slide={s} kas={kas} zona={zona} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="meta">{LABEL_JENIS[s.jenis as JenisSlide] ?? s.jenis}{s.tampilan === "foto" ? " · foto penuh" : ""} · urutan {s.urutan} · {s.durasi} detik</p>
                  <p className="mt-1 font-medium text-forest-900 [overflow-wrap:anywhere]">{s.judul}</p>
                  <p className="mt-1 text-sm text-ink-500">
                    {waktu.format(s.mulai)} sampai {waktu.format(s.selesai)} {zonaSingkat}
                  </p>
                  {s.jenis === "kas" && !kas && <p className="mt-1 text-sm text-red-700">Tidak tampil: publikasi kas mati.</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 pt-3">
                    <Link href={`/admin/tayangan/${s.id}/edit`} className="inline-flex min-h-11 items-center text-sm text-forest-700 hover:text-forest-600">Edit</Link>
                    <TombolAktifSlide id={s.id} aktif={s.aktif} judul={s.judul} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        );
        return (
          <section key={status} className="mt-10" aria-labelledby={`kelompok-${status}`}>
            {ringkas ? (
              <details>
                <summary className="inline-flex min-h-11 cursor-pointer items-center">
                  <h2 id={`kelompok-${status}`} className="section-title">{LABEL_STATUS[status]} ({daftar.length})</h2>
                </summary>
                <p className="mt-1 text-sm text-ink-500">{keterangan}</p>
                {isi}
              </details>
            ) : (
              <>
                <h2 id={`kelompok-${status}`} className="section-title">{LABEL_STATUS[status]} ({daftar.length})</h2>
                <p className="mt-1 text-sm text-ink-500">{keterangan}</p>
                {isi}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
