import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Tempat menyimpan berkas unggahan.
 *
 * - Bila SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terisi (Vercel), berkas
 *   disimpan di Supabase Storage. Media publik (foto tayangan, kegiatan,
 *   logo, suara adzan) di bucket "publik"; bukti transaksi di bucket
 *   "privat" yang hanya bisa dibuka lewat tautan bertanda tangan berumur
 *   pendek setelah pemeriksaan peran.
 * - Bila tidak, berkas ditulis ke disk lokal (UPLOAD_DIR atau uploads/),
 *   cocok untuk pengembangan atau server biasa.
 *
 * Kunci service role hanya dipakai di server dan tidak pernah dikirim ke
 * browser.
 */

export const BUCKET_PUBLIK = "publik";
export const BUCKET_PRIVAT = "privat";

function konfigurasiSupabase() {
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  // Terima juga alamat yang tersalin lengkap dengan /rest/v1/; cukup origin-nya.
  let url = "";
  try {
    url = new URL(process.env.SUPABASE_URL?.trim() ?? "").origin;
  } catch {
    url = "";
  }
  return url && kunci ? { url, kunci } : null;
}

export function memakaiSupabase() {
  return konfigurasiSupabase() !== null;
}

const bucketUntuk = (folder: string) => (folder === "bukti" ? BUCKET_PRIVAT : BUCKET_PUBLIK);

/** Direktori dasar penyimpanan lokal; bisa dialihkan lewat env UPLOAD_DIR. */
export function direktoriUnggahan(): string {
  const bawaan = path.join(process.cwd(), "uploads");
  const dariEnv = process.env.UPLOAD_DIR?.trim();
  if (!dariEnv) return bawaan;
  const hasil = path.resolve(dariEnv);
  // Tolak konfigurasi berbahaya: root drive, root sistem, atau terlalu pendek.
  const akar = path.parse(hasil).root;
  if (hasil === akar || hasil.length < 8) {
    console.error(`UPLOAD_DIR "${dariEnv}" tidak aman (mengarah ke root); memakai uploads/ bawaan.`);
    return bawaan;
  }
  return hasil;
}

/** Simpan isi berkas. Nama berkas sudah acak dan aman dari pemanggil. */
export async function simpanBerkas(folder: string, nama: string, isi: Uint8Array, mime: string): Promise<void> {
  const sb = konfigurasiSupabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${bucketUntuk(folder)}/${folder}/${nama}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sb.kunci}`,
        apikey: sb.kunci,
        "Content-Type": mime,
        // Nama berkas acak tidak pernah dipakai ulang, jadi aman di-cache lama.
        "Cache-Control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: Buffer.from(isi),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Supabase Storage menolak unggahan (${res.status})`);
    return;
  }
  const tujuan = path.join(direktoriUnggahan(), folder);
  await mkdir(tujuan, { recursive: true });
  await writeFile(path.join(tujuan, nama), isi);
}

export type LokasiBerkas =
  | { jenis: "alihkan"; url: string; publik: boolean }
  | { jenis: "isi"; isi: Buffer }
  | { jenis: "tidak-ada" };

/**
 * Cari berkas untuk dilayani route /api/media. Di Supabase, browser
 * dialihkan ke CDN (publik) atau tautan bertanda tangan 60 detik (privat),
 * sehingga berkas besar tidak melewati fungsi Vercel.
 */
export async function lokasiBerkas(folder: string, nama: string): Promise<LokasiBerkas> {
  const sb = konfigurasiSupabase();
  if (sb) {
    const bucket = bucketUntuk(folder);
    if (bucket === BUCKET_PUBLIK) {
      return { jenis: "alihkan", url: `${sb.url}/storage/v1/object/public/${bucket}/${folder}/${nama}`, publik: true };
    }
    const res = await fetch(`${sb.url}/storage/v1/object/sign/${bucket}/${folder}/${nama}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sb.kunci}`, apikey: sb.kunci, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 60 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { jenis: "tidak-ada" };
    const data = (await res.json()) as { signedURL?: string };
    return data.signedURL ? { jenis: "alihkan", url: `${sb.url}/storage/v1${data.signedURL}`, publik: false } : { jenis: "tidak-ada" };
  }

  const dasar = path.join(direktoriUnggahan(), folder);
  const berkas = path.join(dasar, nama);
  // Sabuk pengaman: hasil penggabungan tetap di dalam folder.
  if (!berkas.startsWith(dasar + path.sep)) return { jenis: "tidak-ada" };
  try {
    return { jenis: "isi", isi: await readFile(berkas) };
  } catch {
    return { jenis: "tidak-ada" };
  }
}
