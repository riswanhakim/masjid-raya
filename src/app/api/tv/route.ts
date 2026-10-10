import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ringkasanKasPublik } from "@/lib/data-kas";
import { getPetaPengaturan, pengaturanAngka } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Penanda versi aplikasi (id build Next.js). Layar TV memuat ulang dirinya
// bila nilai ini berubah, sehingga perubahan tampilan sampai ke TV yang
// menyala berhari-hari tanpa disentuh.
let versiAplikasi: string | null = null;
function versi() {
  if (versiAplikasi === null) {
    try {
      versiAplikasi = readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
    } catch {
      versiAplikasi = "pengembangan";
    }
  }
  return versiAplikasi;
}

/**
 * Paket tayangan publik untuk layar TV. Respons dibentuk dari kolom yang
 * memang boleh dilihat jamaah: tanpa pencatat, tanpa bukti, tanpa audit.
 *
 * Slide yang belum mulai ikut dikirim (sampai 7 hari ke depan) supaya layar
 * yang sedang offline tetap bisa menampilkannya tepat waktu; layar sendiri
 * yang memilih slide berdasarkan jam perangkat.
 */
export async function GET() {
  const now = new Date();
  const batasDepan = new Date(now.getTime() + 7 * 86400000);
  const [slides, pengaturan] = await Promise.all([
    prisma.tvSlide.findMany({
      where: { aktif: true, mulai: { lte: batasDepan }, selesai: { gt: now } },
      orderBy: [{ urutan: "asc" }, { createdAt: "asc" }],
      select: { id: true, jenis: true, judul: true, isi: true, gambar: true, penceramah: true, waktuKegiatan: true, lokasi: true, tampilan: true, mulai: true, selesai: true, durasi: true, urutan: true, updatedAt: true },
    }),
    getPetaPengaturan(),
  ]);

  // Ringkasan kas hanya disertakan bila admin mempublikasikannya; slide kas
  // tanpa ringkasan dibuang agar layar tidak menampilkan angka kosong.
  const finance = slides.some((s) => s.jenis === "kas") ? await ringkasanKasPublik() : null;
  const tayang = finance ? slides : slides.filter((s) => s.jenis !== "kas");

  return NextResponse.json(
    {
      slides: tayang,
      finance,
      jedaAyatDetik: pengaturanAngka(pengaturan, "tv_jeda_ayat_detik", { min: 0, max: 600 }),
      versi: versi(),
      updatedAt: now.toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
