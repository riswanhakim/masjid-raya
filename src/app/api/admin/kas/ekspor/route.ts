import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/api-auth";
import { getServerAuth } from "@/lib/get-server-auth";
import { ambilProfil } from "@/lib/profil";
import { hariIniMasjid, muatLaporan, zonaMasjid } from "@/lib/data-kas";
import { bacaFilter } from "@/lib/laporan-kas";
import { buatExcel, buatPdf, namaBerkas } from "@/lib/ekspor-kas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const format = params.format;
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: 'Parameter format harus "xlsx" atau "pdf"' }, { status: 400 });
  }
  const { filter, galat } = bacaFilter(params, await hariIniMasjid());
  if (galat) return NextResponse.json({ error: galat }, { status: 400 });

  const [laporan, profil, zona, { user }] = await Promise.all([muatLaporan(filter), ambilProfil(), zonaMasjid(), getServerAuth()]);
  const meta = {
    namaMasjid: profil.nama,
    alamat: profil.alamat,
    dibuatPada: new Intl.DateTimeFormat("id-ID", { timeZone: zona, dateStyle: "long", timeStyle: "short" }).format(new Date()),
    dibuatOleh: user?.name || user?.email || "Pengguna panel",
  };

  const isi = format === "xlsx" ? await buatExcel(laporan, meta) : await buatPdf(laporan, meta);
  return new NextResponse(new Uint8Array(isi), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${namaBerkas(laporan, format)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const GET = withAdminAuth(getHandler, ["admin", "bendahara"]);
