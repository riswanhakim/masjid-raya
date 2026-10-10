import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { ambilProfil } from "@/lib/profil";
import { ringkasanKasPublik } from "@/lib/data-kas";
import { formatRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await ambilProfil();
  return {
    title: "Laporan Kas",
    description: `Ringkasan kas ${branding.nama} yang dipublikasikan pengurus.`,
  };
}

/**
 * Halaman kas untuk jamaah. Isinya mengikuti aturan publikasi yang sama
 * dengan slide kas di TV: hanya angka ringkasan, dan hanya bila admin sudah
 * mengaktifkan publikasi. Rincian transaksi tetap di panel bendahara.
 */
export default async function KasPage() {
  const [branding, ringkasan] = await Promise.all([ambilProfil(), ringkasanKasPublik()]);

  if (!ringkasan) {
    return (
      <div className="page-shell">
        <PageHeader
          kicker="Transparansi"
          title="Laporan Kas"
          lead={`Ringkasan kas ${branding.nama} belum dipublikasikan. Untuk informasi keuangan, silakan hubungi bendahara atau pengurus masjid.`}
        />
      </div>
    );
  }

  const adaSaldoAwal = ringkasan.dari !== null;

  return (
    <div className="page-shell">
      <PageHeader
        kicker="Transparansi"
        title="Laporan Kas"
        lead={`Ringkasan kas ${branding.nama}: ${ringkasan.periode}.`}
      />

      <section className={`mt-10 grid gap-5 sm:grid-cols-2 ${adaSaldoAwal ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {adaSaldoAwal && (
          <div className="surface p-6">
            <p className="meta">Saldo awal periode</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-forest-900">{formatRupiah(ringkasan.saldoAwal)}</p>
          </div>
        )}
        <div className="surface p-6">
          <p className="meta">Pemasukan</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-forest-700">{formatRupiah(ringkasan.masuk)}</p>
        </div>
        <div className="surface p-6">
          <p className="meta">Pengeluaran</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-red-700">{formatRupiah(ringkasan.keluar)}</p>
        </div>
        <div className="surface p-6">
          <p className="meta">Saldo akhir</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-forest-900">{formatRupiah(ringkasan.saldoAkhir)}</p>
        </div>
      </section>

      {ringkasan.dana.length > 1 && (
        <section className="mt-12">
          <h2 className="section-title">Saldo per dana</h2>
          <div className="rule mt-4" />
          <dl className="mt-2 divide-y divide-forest-900/10">
            {ringkasan.dana.map((d) => (
              <div key={d.nama} className="flex items-baseline justify-between gap-6 py-3">
                <dt className="text-sm text-ink-500">{d.nama}</dt>
                <dd className="text-sm font-medium tabular-nums text-forest-900">{formatRupiah(d.saldo)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {ringkasan.masuk === 0 && ringkasan.keluar === 0 && (
        <p className="mt-10 text-sm text-ink-500">Belum ada transaksi tercatat pada periode ini.</p>
      )}
    </div>
  );
}
