import { z } from "zod";

export const JENIS_SLIDE = ["kajian", "pengumuman", "galeri", "kas"] as const;
export type JenisSlide = (typeof JENIS_SLIDE)[number];

export const TAMPILAN_SLIDE = ["standar", "foto"] as const;
export type TampilanSlide = (typeof TAMPILAN_SLIDE)[number];

export const LABEL_JENIS: Record<JenisSlide, string> = {
  kajian: "Kajian",
  pengumuman: "Pengumuman",
  galeri: "Galeri",
  kas: "Ringkasan kas",
};

const teksOpsional = (maks: number) =>
  z.string().trim().max(maks).nullable().optional().transform((v) => (v ? v : null));

export const slideSchema = z.object({
  jenis: z.enum(JENIS_SLIDE),
  judul: z.string().trim().min(1, "Judul wajib diisi").max(160, "Judul maksimal 160 karakter"),
  isi: teksOpsional(2000),
  gambar: z.string().regex(/^\/api\/media\/(tayangan|kegiatan|berita)\/[a-f0-9]{32}\.(jpg|png|webp|gif)$/, "Gambar harus hasil unggahan").nullable().optional(),
  penceramah: teksOpsional(120),
  waktuKegiatan: z.string().datetime({ offset: true }).nullable().optional(),
  lokasi: teksOpsional(160),
  tampilan: z.enum(TAMPILAN_SLIDE).default("standar"),
  mulai: z.string().datetime({ offset: true }),
  selesai: z.string().datetime({ offset: true }),
  durasi: z.number().int().min(5, "Durasi minimal 5 detik").max(120, "Durasi maksimal 120 detik"),
  urutan: z.number().int().min(0).max(9999),
  aktif: z.boolean(),
}).strict().refine((d) => new Date(d.selesai) > new Date(d.mulai), { message: "Akhir tayang harus setelah awal tayang", path: ["selesai"] })
  .refine((d) => d.jenis !== "galeri" || !!d.gambar, { message: "Foto galeri wajib diunggah", path: ["gambar"] })
  .refine((d) => d.tampilan !== "foto" || d.jenis !== "kas", { message: "Ringkasan kas tidak bisa memakai tampilan foto penuh", path: ["tampilan"] })
  .refine((d) => d.tampilan !== "foto" || !!d.gambar, { message: "Tampilan foto penuh membutuhkan foto", path: ["gambar"] });

export type StatusSlide = "tayang" | "dijadwalkan" | "kedaluwarsa" | "nonaktif";

export const LABEL_STATUS: Record<StatusSlide, string> = {
  tayang: "Sedang tayang",
  dijadwalkan: "Dijadwalkan",
  kedaluwarsa: "Kedaluwarsa",
  nonaktif: "Nonaktif",
};

export function statusSlide(s: { aktif: boolean; mulai: Date | string; selesai: Date | string }, now = new Date()): StatusSlide {
  if (!s.aktif) return "nonaktif";
  if (new Date(s.mulai) > now) return "dijadwalkan";
  if (new Date(s.selesai) <= now) return "kedaluwarsa";
  return "tayang";
}

/** Slide yang tayang pada saat `now`, sudah terurut. Dipakai layar TV, termasuk saat offline. */
export function slideBerlaku<T extends { aktif?: boolean; mulai: Date | string; selesai: Date | string }>(slides: T[], now = new Date()): T[] {
  return slides.filter((s) => statusSlide({ aktif: s.aktif ?? true, mulai: s.mulai, selesai: s.selesai }, now) === "tayang");
}

/** Ubah masukan tervalidasi menjadi data Prisma; kolom kajian dikosongkan untuk jenis lain. */
export function dataSlide(d: z.output<typeof slideSchema>) {
  return {
    ...d,
    gambar: d.gambar ?? null,
    waktuKegiatan: d.jenis === "kajian" && d.waktuKegiatan ? new Date(d.waktuKegiatan) : null,
    penceramah: d.jenis === "kajian" ? d.penceramah : null,
    lokasi: d.jenis === "kajian" ? d.lokasi : null,
    mulai: new Date(d.mulai),
    selesai: new Date(d.selesai),
  };
}

/* ---------------------- Waktu lokal masjid (tanpa DST) ---------------------- */

const OFFSET: Record<string, string> = { "Asia/Jakarta": "+07:00", "Asia/Makassar": "+08:00", "Asia/Jayapura": "+09:00" };
export const SINGKATAN_ZONA: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };

/** "2026-10-16T19:30" (jam masjid) menjadi ISO dengan offset yang benar. */
export function lokalKeIso(lokal: string, zona: string): string {
  return `${lokal.length === 16 ? `${lokal}:00` : lokal}${OFFSET[zona] ?? "+07:00"}`;
}

/** Kebalikan lokalKeIso: nilai untuk <input type="datetime-local">. */
export function isoKeLokal(nilai: Date | string, zona: string): string {
  const jam = Number((OFFSET[zona] ?? "+07:00").slice(1, 3));
  return new Date(new Date(nilai).getTime() + jam * 3600000).toISOString().slice(0, 16);
}

/** "Kamis, 16 Oktober 2026, 19.30 WIB" */
export function labelWaktuLokal(nilai: Date | string, zona: string): string {
  const teks = new Intl.DateTimeFormat("id-ID", { timeZone: zona, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(nilai));
  return `${teks.replace(" pukul", ",")} ${SINGKATAN_ZONA[zona] ?? ""}`.trim();
}
