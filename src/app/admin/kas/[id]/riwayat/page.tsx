import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { KepalaAdmin } from "@/components/admin/AdminShell";
import { formatRupiah } from "@/lib/format";
import { zonaMasjid } from "@/lib/data-kas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Riwayat Transaksi" };

const LABEL_KOLOM: Record<string, string> = {
  tanggal: "Tanggal",
  jenis: "Jenis",
  jumlah: "Jumlah",
  dana: "Dana",
  kategori: "Kategori",
  keterangan: "Keterangan",
  bukti: "Bukti",
};

const LABEL_AKSI: Record<string, string> = { create: "Dicatat", update: "Dikoreksi", void: "Dibatalkan" };

function tampil(kolom: string, nilai: unknown): string {
  if (nilai === null || nilai === undefined || nilai === "") return "kosong";
  if (kolom === "jumlah") return formatRupiah(Number(nilai));
  if (kolom === "tanggal") return String(nilai).slice(0, 10).split("-").reverse().join("/");
  if (kolom === "jenis") return nilai === "masuk" ? "Pemasukan" : "Pengeluaran";
  if (kolom === "bukti") return "ada lampiran";
  return String(nilai);
}

function baca(json: string | null): Record<string, unknown> {
  try {
    return json ? (JSON.parse(json) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Jejak lengkap satu transaksi: siapa, kapan, apa yang berubah, dan alasannya. */
export default async function RiwayatKas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, log, zona] = await Promise.all([
    prisma.kasTransaksi.findUnique({ where: { id } }),
    prisma.auditLog.findMany({ where: { entity: "kas", entityId: id }, orderBy: { createdAt: "asc" } }),
    zonaMasjid(),
  ]);
  if (!t) notFound();
  const pelaku = new Map(
    (await prisma.user.findMany({ where: { id: { in: [...new Set(log.map((l) => l.actorId))] } }, select: { id: true, name: true, email: true } }))
      .map((u) => [u.id, u.name || u.email])
  );
  const waktu = new Intl.DateTimeFormat("id-ID", { timeZone: zona, dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="max-w-3xl">
      <KepalaAdmin
        kicker="Keuangan"
        judul="Riwayat Transaksi"
        keterangan={`${t.keterangan}, ${formatRupiah(t.jumlah)}, dana ${t.dana}.`}
        aksi={<Link href="/admin/kas" className="btn btn-outline min-h-11">Kembali ke buku kas</Link>}
      />

      {t.deletedAt && (
        <p role="status" className="mt-6 rounded-lg border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-800">
          Transaksi ini sudah dibatalkan dan tidak dihitung dalam saldo.
        </p>
      )}

      {log.length === 0 ? (
        <p className="mt-8 text-sm text-ink-500">
          Belum ada riwayat untuk transaksi ini. Transaksi yang dicatat sebelum fitur audit aktif tidak punya jejak awal.
        </p>
      ) : (
        <ol className="mt-8 space-y-4">
          {log.map((l) => {
            const before = baca(l.before);
            const after = baca(l.after);
            const berubah = Object.keys(LABEL_KOLOM).filter((k) => l.action === "update" && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
            return (
              <li key={l.id} className="surface p-5">
                <p className="text-sm">
                  <span className="font-semibold text-forest-900">{LABEL_AKSI[l.action] ?? l.action}</span>
                  <span className="text-ink-500"> oleh {pelaku.get(l.actorId) ?? "akun yang sudah dihapus"}, {waktu.format(l.createdAt)}</span>
                  {l.action === "create" && after.sumber === "telegram" && <span className="text-ink-500"> lewat Telegram</span>}
                </p>
                {l.alasan && <p className="mt-2 text-sm text-ink-500">Alasan: <span className="text-forest-900">{l.alasan}</span></p>}
                {l.action === "create" && (
                  <p className="mt-2 text-sm text-ink-500">
                    {tampil("jenis", after.jenis)} {tampil("jumlah", after.jumlah)}, {tampil("tanggal", after.tanggal)}, dana {tampil("dana", after.dana)}, kategori {tampil("kategori", after.kategori)}.
                  </p>
                )}
                {berubah.length > 0 && (
                  <dl className="mt-3 divide-y divide-forest-900/10 text-sm">
                    {berubah.map((k) => (
                      <div key={k} className="grid gap-1 py-2 sm:grid-cols-[8rem_1fr]">
                        <dt className="text-ink-500">{LABEL_KOLOM[k]}</dt>
                        <dd className="[overflow-wrap:anywhere]">
                          <del className="text-ink-500">{tampil(k, before[k])}</del>
                          <span className="px-2 text-ink-500">menjadi</span>
                          <ins className="font-medium text-forest-900 no-underline">{tampil(k, after[k])}</ins>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
