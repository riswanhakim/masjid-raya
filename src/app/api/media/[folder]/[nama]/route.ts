import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/get-server-auth";
import { canFinance } from "@/lib/permissions";
import { folderUnggahanValid, mimeDariEkstensi, namaBerkasAman } from "@/lib/upload";
import { lokasiBerkas } from "@/lib/penyimpanan";

/**
 * Sajikan berkas unggahan.
 *
 * Berkas disimpan di luar `public/` sehingga satu-satunya jalan keluar adalah
 * route ini, yang bisa memaksa `Content-Type` yang benar, melarang sniffing
 * tipe, dan menolak nama berkas berbahaya (path traversal, ekstensi ganda).
 * Nama berkas dibuat acak saat diunggah, jadi isinya tidak akan berubah untuk
 * nama yang sama — aman di-cache selamanya.
 */

export const runtime = "nodejs";

const KONTROL_CACHE = "public, max-age=31536000, immutable";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ folder: string; nama: string }> }
) {
  const { folder, nama } = await params;
  if (folder === "bukti") {
    const { role } = await getServerAuth();
    if (!canFinance(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!folderUnggahanValid(folder) || !namaBerkasAman(nama)) {
    return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
  }

  const lokasi = await lokasiBerkas(folder, nama);
  if (lokasi.jenis === "tidak-ada") {
    return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
  }
  // Supabase Storage: alihkan ke CDN (publik) atau tautan bertanda tangan
  // 60 detik (bukti). Berkas tidak melewati fungsi server.
  if (lokasi.jenis === "alihkan") {
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: lokasi.url,
        "Cache-Control": lokasi.publik ? "public, max-age=86400" : "private, no-store",
      },
    });
  }
  const isi = lokasi.isi;

  const mime = mimeDariEkstensi(nama);

  // Tipe tak dikenal: tolak daripada menyajikan application/octet-stream
  // inline (walau nosniff, inline octet-stream berisiko diunduh/misrender).
  if (mime === "application/octet-stream") {
    return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(isi), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(isi.byteLength),
      "Content-Disposition": "inline",
      "Cache-Control": folder === "bukti" ? "private, no-store" : KONTROL_CACHE,
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
