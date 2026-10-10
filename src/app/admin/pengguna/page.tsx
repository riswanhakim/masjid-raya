import type { Metadata } from "next";
import Link from "next/link";
import prisma from "@/lib/prisma";
import {
  AdminKosong,
  KartuAdmin,
  KepalaAdmin,
  TautanAksi,
} from "@/components/admin/AdminShell";
import TombolHapus from "@/components/admin/TombolHapus";
import { IkonPensil, IkonTambah } from "@/components/Ikon";
import { tanggalSedang } from "@/lib/format";
import { getPetaPengaturan } from "@/lib/settings";
import { normalisasiLokasi } from "@/lib/kota";
import { LABEL_PERAN } from "@/lib/menu-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pengguna" };


export default async function AdminPenggunaPage() {
  const [pengguna, pengaturan] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, telegramId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    getPetaPengaturan(),
  ]);

  const zona = normalisasiLokasi(pengaturan.lokasi_default).zona;

  return (
    <div>
      <KepalaAdmin
        kicker="Administrasi"
        judul="Pengguna"
        keterangan="Kelola akun panel (admin, bendahara, pengurus konten, jamaah) dan tautkan akun Telegram pengurus ke bot. Sandi setiap akun dapat direset dari sini."
        aksi={
          <TautanAksi href="/admin/pengguna/tambah">
            <IkonTambah className="h-4 w-4" />
            Tambah pengguna
          </TautanAksi>
        }
      />

      <div className="mt-8">
        <KartuAdmin>
          {pengguna.length === 0 ? (
            <AdminKosong
              pesan="Belum ada pengguna."
              aksi={{ href: "/admin/pengguna/tambah", label: "Tambah pengguna" }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem]">
                <thead>
                  <tr className="border-b border-forest-900/10 bg-forest-50/70 text-left">
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                      Nama
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                      Surel
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                      Peran
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                      Telegram
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-400">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-900/10">
                  {pengguna.map((item) => (
                    <tr key={item.id} className="transition hover:bg-forest-50/50">
                      <td className="px-6 py-4 font-medium text-forest-900">
                        {item.name || "Tanpa nama"}
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-500">{item.email}</td>
                      <td className="px-6 py-4">
                        <span className="chip">{LABEL_PERAN[item.role] ?? item.role}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-500">
                        {item.telegramId ? `Tertaut (${item.telegramId})` : item.role === "jamaah" ? "Tidak perlu" : "Belum tertaut"}
                        <span className="meta block">Dibuat {tanggalSedang(item.createdAt, zona)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-5">
                          <Link
                            href={`/admin/pengguna/${item.id}/edit`}
                            className="inline-flex items-center gap-1.5 text-sm text-forest-700 transition hover:text-forest-600"
                          >
                            <IkonPensil className="h-4 w-4" />
                            Edit
                          </Link>
                          <TombolHapus
                            endpoint={`/api/admin/pengguna/${item.id}`}
                            nama={item.name || item.email}
                            jenis="pengguna"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </KartuAdmin>
      </div>
    </div>
  );
}
