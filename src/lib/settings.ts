import prisma from "@/lib/prisma";

/**
 * Nilai bawaan seluruh pengaturan. Setiap kunci di sini otomatis boleh
 * disimpan lewat API `/api/pengaturan` dan muncul sebagai nilai awal bila
 * barisnya belum ada di database.
 */
export const PENGATURAN_BAWAAN = {
  /** Kota acuan perhitungan jadwal shalat (lihat lib/kota.ts). */
  lokasi_default: "Jakarta",

  /** Sumber perhitungan jadwal: hisab lokal atau API Aladhan. */
  sumber_jadwal: "hisab",
  /** Tambahan keamanan (ihtiyati) dalam menit, 0–5. */
  ihtiyati_menit: "2",
  /**
   * Penyesuaian tanggal Hijriah (hari). Kalender Umm al-Qura sering berbeda
   * satu hari dengan kalender Kemenag RI; pengurus menggeser -2..+2 agar cocok.
   */
  hijriah_offset_hari: "0",

  /** Suara adzan. Mati secara bawaan (permintaan pengurus); hitung mundur dan layar shalat tetap tampil tanpa suara. */
  adzan_enabled: "false",
  /** Id pilihan suara adzan umum (Zuhur, Ashar, Maghrib, Isya) dari lib/azan.ts. */
  adzan_pilihan: "adzan-1",
  /** Url kustom (https) atau hasil unggah (/api/media/adzan/...) bila adzan_pilihan = "kustom". */
  adzan_audio_url: "",

  /** Id pilihan suara adzan khusus Subuh (memuat tatswib). */
  adzan_subuh_pilihan: "adzan-subuh-bawaan",
  /** Url kustom suara adzan khusus Subuh (bila ada). */
  adzan_subuh_audio_url: "",

  /** Jeda iqomah setelah adzan, dalam menit. */
  iqomah_menit: "10",

  /** Peringatan menjelang waktu shalat, dalam menit. */
  reminder_menit: "5",
  reminder_suara: "true",

  /** Tampilkan pemutar murottal di beranda. */
  tampilkan_murottal: "true",
  /** Id reciter murottal dari lib/murottal.ts (suara pengisi bacaan ayat). */
  murottal_reciter: "alafasy",
  /**
   * Jeda murottal setelah adzan selesai, dalam menit (0–120). Selama jeda,
   * murottal ditahan lalu lanjut otomatis. 0 = lanjut segera setelah adzan.
   */
  murottal_jeda_menit: "30",
  /**
   * Jendela jam tayang murottal harian (HH:MM). Keduanya kosong = tayang
   * seharian; mendukung rentang lewat tengah malam (mis. 20:00–04:00).
   */
  murottal_mulai: "",
  murottal_selesai: "",
  /**
   * Kapan murottal berbunyi: "menjelang_adzan" (hanya beberapa menit sebelum
   * tiap adzan) atau "jam_tayang" (sepanjang jendela jam tayang, dan tetap
   * menyala otomatis menjelang adzan walau di luar jendela).
   */
  murottal_mode: "menjelang_adzan",
  /** Berapa menit sebelum adzan murottal mulai otomatis (1–60). */
  murottal_pra_adzan_menit: "10",
  /**
   * Lama layar penuh "shalat berlangsung" setelah iqomah, dalam menit (0–60).
   * Dari masuk waktu sampai iqomah, layar penuh menampilkan hitung mundur.
   */
  layar_shalat_menit: "10",
  /**
   * Mode tampilan panel ayat: "pilihan" (kurasi ayat pendek) atau
   * "surah" (satu surah penuh per `surah_nomor`). Pilihan admin di UI
   * menyusul; kunci ini disiapkan agar API dan papan sudah mendukung.
   */
  mode_ayat: "pilihan",
  /** Nomor surah 1–114 yang ditampilkan bila `mode_ayat` = "surah". */
  surah_nomor: "112",
  /**
   * Perilaku setelah satu surah tuntas: "ulang" (mengulang surah yang sama)
   * atau "lanjut" (maju ke surah berikutnya, 114 → 1, hingga khatam).
   */
  surah_lanjut: "ulang",

  /**
   * Publikasi ringkasan kas ke jamaah (halaman /kas dan slide kas di TV).
   * Hanya admin yang boleh mengubah. Mati secara bawaan.
   */
  kas_publik: "false",
  /** "bulan_ini" | "tahun_ini" | "semua". */
  kas_publik_periode: "bulan_ini",
  /** Nama dana yang disertakan, satu per baris. Kosong = semua dana. */
  kas_publik_dana: "",

  /** Lama panel ayat tampil di sela slide tayangan, dalam detik (0 = tanpa ayat). */
  tv_jeda_ayat_detik: "60",

  running_text:
    "Selamat datang di masjid kami. Mari jaga kebersihan dan ketertiban bersama.",
} as const;

export type KunciPengaturan = keyof typeof PENGATURAN_BAWAAN;
export type PetaPengaturan = Record<KunciPengaturan, string>;

export const KUNCI_PENGATURAN = Object.keys(
  PENGATURAN_BAWAAN
) as KunciPengaturan[];

export function kunciPengaturanValid(kunci: string): kunci is KunciPengaturan {
  return (KUNCI_PENGATURAN as string[]).includes(kunci);
}

/** Nilai bawaan satu kunci, sebagai string. */
export function bawaanPengaturan(kunci: KunciPengaturan): string {
  return PENGATURAN_BAWAAN[kunci];
}

/**
 * Baca seluruh pengaturan yang dikenal sebagai satu peta, dengan nilai bawaan
 * bila barisnya belum ada. Aman dipanggil dari server component.
 */
export async function getPetaPengaturan(): Promise<PetaPengaturan> {
  const peta = { ...PENGATURAN_BAWAAN } as PetaPengaturan;

  try {
    const baris = await prisma.pengaturan.findMany({
      where: { key: { in: KUNCI_PENGATURAN } },
    });
    for (const item of baris) {
      if (kunciPengaturanValid(item.key)) {
        peta[item.key] = item.value;
      }
    }
  } catch {
    // Bila database belum siap, pakai nilai bawaan saja.
  }

  return peta;
}

/**
 * Peta pengaturan lengkap dalam bentuk daftar baris, sudah termasuk nilai
 * bawaan. Dipakai API supaya panel admin selalu bisa menyunting Setiap kunci —
 * termasuk yang barisnya belum pernah ada di database.
 */
export async function daftarPengaturanLengkap(): Promise<
  { key: KunciPengaturan; value: string; bawaan: string; tersimpan: boolean }[]
> {
  const peta = await getPetaPengaturan();

  let tersimpan = new Set<string>();
  try {
    const baris = await prisma.pengaturan.findMany({
      where: { key: { in: KUNCI_PENGATURAN } },
      select: { key: true },
    });
    tersimpan = new Set(baris.map((b) => b.key));
  } catch {
    // Abaikan; anggap belum ada yang tersimpan.
  }

  return KUNCI_PENGATURAN.map((key) => ({
    key,
    value: peta[key],
    bawaan: PENGATURAN_BAWAAN[key],
    tersimpan: tersimpan.has(key),
  }));
}

/** Ambil pengaturan sebagai angka, dengan pengaman bila isinya tidak sah. */
export function pengaturanAngka(
  peta: PetaPengaturan,
  kunci: KunciPengaturan,
  batas: { min: number; max: number }
): number {
  const nilai = Number(peta[kunci]);
  if (!Number.isFinite(nilai)) return Number(PENGATURAN_BAWAAN[kunci]);
  return Math.min(batas.max, Math.max(batas.min, Math.round(nilai)));
}

/** Ambil pengaturan sebagai saklar on/off. */
export function pengaturanSaklar(
  peta: PetaPengaturan,
  kunci: KunciPengaturan
): boolean {
  return peta[kunci] === "true";
}
