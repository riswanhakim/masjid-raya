import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/api-auth";
import { bacaTubuh, galatDatabase, tanggalKeDate } from "@/lib/api-util";
import { ringkasGalat } from "@/lib/validasi";
import { getPetaPengaturan } from "@/lib/settings";
import { normalisasiLokasi } from "@/lib/kota";
import {
  getJadwalHarian,
  hijriahLokal,
  kunciTanggal,
  kunciTanggalValid,
  type SumberJadwal,
} from "@/lib/prayer-times";
import { jadwalSimpanSchema } from "@/lib/validasi";

// Jadwal bergantung pada tanggal berjalan, jadi tidak boleh di-cache statis.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const pencarianSchema = z.object({
  tanggal: z
    .string()
    .refine(kunciTanggalValid, "Parameter tanggal harus berformat YYYY-MM-DD")
    .optional(),
  lokasi: z.string().trim().min(1).max(64).optional(),
  hari: z.coerce.number().int().min(1).max(7).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const mentah = {
      tanggal: request.nextUrl.searchParams.get("tanggal") ?? undefined,
      lokasi: request.nextUrl.searchParams.get("lokasi") ?? undefined,
      hari: request.nextUrl.searchParams.get("hari") ?? undefined,
    };

    const hasil = pencarianSchema.safeParse(mentah);
    if (!hasil.success) {
      return NextResponse.json(ringkasGalat(hasil.error), { status: 400 });
    }

    const pengaturan = await getPetaPengaturan();
    let kanonik = normalisasiLokasi(hasil.data.lokasi ?? pengaturan.lokasi_default ?? "Jakarta");

    // Jika lokasi tidak memiliki koordinat, gunakan default Jakarta
    if (!kanonik.koordinat) {
      kanonik = normalisasiLokasi("Jakarta");
    }

    const sumber: SumberJadwal =
      pengaturan.sumber_jadwal === "aladhan" ? "aladhan" : "hisab";
    const ihtiyati = Number(pengaturan.ihtiyati_menit);
    const hijriahOffsetMentah = Number(pengaturan.hijriah_offset_hari);
    const hijriahOffsetHari = Number.isFinite(hijriahOffsetMentah)
      ? hijriahOffsetMentah
      : 0;
    const kunci = hasil.data.tanggal ?? kunciTanggal(new Date(), kanonik.zona);

    // Paket beberapa hari sekaligus untuk layar TV yang perlu tetap benar
    // saat offline. Jadwal manual tetap menang karena tiap hari dibaca lewat
    // getJadwalHarian yang sama.
    if (hasil.data.hari) {
      // Paket selalu untuk lokasi masjid (bukan lokasi kiriman), agar permintaan
      // anonim tidak bisa memicu hitung ulang untuk kota sembarang.
      kanonik = normalisasiLokasi(pengaturan.lokasi_default || "Jakarta");
      if (!kanonik.koordinat) kanonik = normalisasiLokasi("Jakarta");
      const opsi = { sumber, ihtiyatiMenit: Number.isFinite(ihtiyati) ? ihtiyati : 2, hijriahOffsetHari };
      const daftar = [];
      for (let i = 0; i < hasil.data.hari; i++) {
        const d = new Date(`${kunci}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + i);
        const tgl = d.toISOString().slice(0, 10);
        const j = await getJadwalHarian(kanonik.kota, tgl, opsi);
        if (j) daftar.push({ ...j, tanggal: tgl, hijriah: hijriahLokal(new Date(`${tgl}T06:00:00Z`), kanonik.zona, hijriahOffsetHari) });
      }
      return NextResponse.json({ lokasi: kanonik.kota, zona: kanonik.zona, jadwal: daftar }, { headers: { "Cache-Control": "no-store" } });
    }

    const jadwal = await getJadwalHarian(kanonik.kota, kunci, {
      sumber,
      ihtiyatiMenit: Number.isFinite(ihtiyati) ? ihtiyati : 2,
      hijriahOffsetHari,
    });

    if (!jadwal) {
      return NextResponse.json(
        {
          error:
            "Jadwal shalat sedang tidak dapat dimuat. Silakan coba beberapa saat lagi.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ...jadwal,
        hijriah:
          jadwal.hijriah || hijriahLokal(new Date(), kanonik.zona, hijriahOffsetHari),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error fetching jadwal:", error);
    return NextResponse.json({ error: "Gagal memuat jadwal" }, { status: 500 });
  }
}

/**
 * Simpan jadwal manual. Jalur tulis utama sekarang ada di `/api/admin/jadwal`;
 * handler ini dipertahankan untuk pemanggil lama dan memakai validasi yang sama.
 */
async function postHandler(request: NextRequest) {
  const dibaca = await bacaTubuh(request, jadwalSimpanSchema);
  if (!dibaca.ok) return dibaca.respons;

  const d = dibaca.data;
  const tanggal = tanggalKeDate(d.tanggal);

  try {
    const jadwal = await prisma.jadwalShalat.upsert({
      where: { tanggal_lokasi: { tanggal, lokasi: d.lokasi } },
      update: { ...d, tanggal, sumber: "manual" },
      create: { ...d, tanggal, sumber: "manual" },
    });
    return NextResponse.json(jadwal, { status: 201 });
  } catch (error) {
    return galatDatabase(error, "Gagal menyimpan jadwal");
  }
}

export const POST = withAdminAuth(postHandler, ["admin"]);
