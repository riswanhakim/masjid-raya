import type { Metadata } from "next";
import Link from "next/link";
import { KepalaAdmin, TautanAksi } from "@/components/admin/AdminShell";
import GrafikBulanan from "@/components/admin/kas/GrafikBulanan";
import TombolBatalKas from "@/components/admin/kas/TombolBatalKas";
import { IkonTambah, IkonUnduh } from "@/components/Ikon";
import { formatRupiah } from "@/lib/format";
import { getServerAuth } from "@/lib/get-server-auth";
import { daftarDana, daftarKategori, hariIniMasjid, muatLaporan } from "@/lib/data-kas";
import { bacaFilter, labelBulan, labelHari, labelPeriode, queryFilter, TANPA_KATEGORI, type FilterKas } from "@/lib/laporan-kas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buku Kas" };

function tanggalPendek(d: Date) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(d);
}

function geserBulan(hari: string, n: number) {
  const d = new Date(`${hari.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function akhirBulan(awal: string) {
  const d = new Date(`${awal}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Buku kas bendahara. Keputusan utama di layar ini: berapa saldo dana yang
 * dipilih, dan transaksi mana yang perlu diperiksa atau dikoreksi. Karena itu
 * saldo akhir menjadi titik fokus, disusul daftar transaksi; grafik dan
 * rincian kategori ada di bawah sebagai bahan penelusuran.
 */
export default async function AdminKasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const hariIni = await hariIniMasjid();
  const { filter, galat } = bacaFilter(params, hariIni);
  const [lap, dana, kategori, { role }] = await Promise.all([muatLaporan(filter), daftarDana(), daftarKategori(), getServerAuth()]);

  const tautan = (ubah: Partial<FilterKas>) => `/admin/kas?${queryFilter({ ...filter, ...ubah })}`;
  const bulanIni = geserBulan(hariIni, 0);
  const bulanLalu = geserBulan(hariIni, -1);
  const pintasan = [
    { label: "Bulan ini", dari: bulanIni, sampai: hariIni },
    { label: "Bulan lalu", dari: bulanLalu, sampai: akhirBulan(bulanLalu) },
    { label: "Tahun ini", dari: `${hariIni.slice(0, 4)}-01-01`, sampai: hariIni },
  ];
  const cakupan = `${filter.dana || "Semua dana"}, ${labelPeriode(filter)}`;
  const r = lap.ringkasan;

  return (
    <div>
      <KepalaAdmin
        kicker="Keuangan"
        judul="Buku Kas"
        keterangan="Catat, periksa, dan laporkan kas masjid. Transaksi yang dibatalkan tidak dihitung, tetapi riwayatnya tetap tersimpan."
        aksi={
          <>
            <TautanAksi href="/admin/kas/tambah">
              <IkonTambah className="h-4 w-4" />
              Catat transaksi
            </TautanAksi>
            <Link href="/admin/kas/dana" className="btn btn-outline min-h-11">Kelola dana</Link>
            <Link href="/admin/kas/batal" className="btn btn-outline min-h-11">Dibatalkan</Link>
            {role === "admin" && <Link href="/admin/kas/publikasi" className="btn btn-outline min-h-11">Publikasi ke jamaah</Link>}
          </>
        }
      />

      {/* Saringan: formulir GET biasa, jadi tetap bekerja tanpa JavaScript dan tautannya bisa dibagikan. */}
      <form method="get" className="surface mt-8 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <div>
          <label htmlFor="dari" className="field-label">Dari tanggal</label>
          <input id="dari" name="dari" type="date" className="field min-h-11" defaultValue={filter.dari} required />
        </div>
        <div>
          <label htmlFor="sampai" className="field-label">Sampai tanggal</label>
          <input id="sampai" name="sampai" type="date" className="field min-h-11" defaultValue={filter.sampai} required />
        </div>
        <div>
          <label htmlFor="dana" className="field-label">Dana</label>
          <select id="dana" name="dana" className="field min-h-11" defaultValue={filter.dana}>
            <option value="">Semua dana</option>
            {dana.map((d) => <option key={d.id} value={d.nama}>{d.nama}{d.aktif ? "" : " (nonaktif)"}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="jenis" className="field-label">Jenis</label>
          <select id="jenis" name="jenis" className="field min-h-11" defaultValue={filter.jenis}>
            <option value="">Masuk dan keluar</option>
            <option value="masuk">Pemasukan</option>
            <option value="keluar">Pengeluaran</option>
          </select>
        </div>
        <div>
          <label htmlFor="kategori" className="field-label">Kategori</label>
          <select id="kategori" name="kategori" className="field min-h-11" defaultValue={filter.kategori}>
            <option value="">Semua kategori</option>
            {[...kategori, TANPA_KATEGORI].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="q" className="field-label">Cari keterangan</label>
          <input id="q" name="q" type="search" className="field min-h-11" defaultValue={filter.q} placeholder="Contoh: listrik" maxLength={100} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3 2xl:col-span-6">
          <button type="submit" className="btn btn-primary min-h-11">Terapkan saringan</button>
          <Link href="/admin/kas" className="btn btn-quiet min-h-11">Atur ulang</Link>
          <span className="text-sm text-ink-500">Pintasan:</span>
          {pintasan.map((p) => (
            <Link key={p.label} href={tautan({ dari: p.dari, sampai: p.sampai })} className="btn btn-outline min-h-11 py-1.5">{p.label}</Link>
          ))}
        </div>
        {galat && <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-3 2xl:col-span-6">{galat}. Menampilkan bulan ini.</p>}
      </form>

      {/* Persamaan saldo: saldo awal + pemasukan − pengeluaran = saldo akhir. */}
      <section aria-labelledby="judul-ringkasan" className="mt-8">
        <h2 id="judul-ringkasan" className="text-sm text-ink-500">Ringkasan saldo: {cakupan}</h2>
        <div className="mt-3 grid gap-px overflow-hidden rounded-xl border border-forest-900/10 bg-forest-900/10 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr]">
          <div className="bg-white/80 p-5">
            <p className="meta">Saldo awal periode</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-forest-900">{formatRupiah(r.saldoAwal)}</p>
          </div>
          <div className="bg-white/80 p-5">
            <p className="meta">+ Pemasukan</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-forest-700">{formatRupiah(r.masuk)}</p>
          </div>
          <div className="bg-white/80 p-5">
            <p className="meta">− Pengeluaran</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-red-700">{formatRupiah(r.keluar)}</p>
          </div>
          <div className="bg-forest-800 p-5 text-paper">
            <p className="text-xs text-forest-100">= Saldo akhir periode</p>
            <p className="mt-1 font-display text-3xl tabular-nums">{formatRupiah(r.saldoAkhir)}</p>
          </div>
        </div>
        {!filter.dana && lap.saldoPerDana.length > 1 && (
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-500">
            <span>Saldo per dana pada {labelHari(filter.sampai)}:</span>
            {lap.saldoPerDana.map((d) => (
              <Link key={d.dana} href={tautan({ dana: d.dana })} className="link-hairline tabular-nums">{d.dana} {formatRupiah(d.saldo)}</Link>
            ))}
          </p>
        )}
      </section>

      <section aria-labelledby="judul-transaksi" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="judul-transaksi" className="section-title">Transaksi ({lap.subtotal.jumlahBaris})</h2>
            <p className="mt-1 text-sm text-ink-500">
              Subtotal daftar: masuk <span className="tabular-nums text-forest-900">{formatRupiah(lap.subtotal.masuk)}</span>, keluar <span className="tabular-nums text-forest-900">{formatRupiah(lap.subtotal.keluar)}</span>
              {lap.daftarTersaring && ". Daftar disaring, jadi subtotal ini bisa berbeda dari ringkasan saldo di atas."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/admin/kas/ekspor?${queryFilter(filter, { format: "xlsx" })}`} className="btn btn-outline min-h-11"><IkonUnduh className="h-4 w-4" />Unduh Excel</a>
            <a href={`/api/admin/kas/ekspor?${queryFilter(filter, { format: "pdf" })}`} className="btn btn-outline min-h-11"><IkonUnduh className="h-4 w-4" />Unduh PDF</a>
          </div>
        </div>

        {lap.baris.length === 0 ? (
          <div className="surface mt-4 p-6">
            {lap.daftarTersaring ? (
              <p className="text-sm text-ink-500">Tidak ada transaksi yang cocok dengan saringan. <Link className="link-hairline" href={tautan({ jenis: "", kategori: "", q: "" })}>Hapus saringan jenis, kategori, dan pencarian</Link>.</p>
            ) : (
              <p className="text-sm text-ink-500">Belum ada transaksi untuk {cakupan}. <Link className="link-hairline" href="/admin/kas/tambah">Catat transaksi pertama</Link>, atau pilih periode lain.</p>
            )}
          </div>
        ) : (
          <>
            {/* HP: kartu per transaksi. */}
            <ul className="mt-4 space-y-3 md:hidden">
              {lap.baris.map((b) => (
                <li key={b.id} className="surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-forest-900 [overflow-wrap:anywhere]">{b.keterangan}</p>
                      <p className="meta mt-1">{tanggalPendek(b.tanggal)} · {b.dana}{b.kategori ? ` · ${b.kategori}` : ""}</p>
                    </div>
                    <p className={`shrink-0 font-semibold tabular-nums ${b.jenis === "masuk" ? "text-forest-700" : "text-red-700"}`}>
                      {b.jenis === "masuk" ? "+" : "−"}{formatRupiah(b.jumlah)}
                    </p>
                  </div>
                  <p className="meta mt-2">Dicatat {b.pencatat} lewat {b.sumber === "telegram" ? "Telegram" : "panel"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 border-t border-forest-900/10 pt-2 text-sm">
                    {b.bukti && <a href={b.bukti} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center text-forest-700">Lihat bukti</a>}
                    <Link href={`/admin/kas/${b.id}/edit`} className="inline-flex min-h-11 items-center text-forest-700">Koreksi</Link>
                    <Link href={`/admin/kas/${b.id}/riwayat`} className="inline-flex min-h-11 items-center text-forest-700">Riwayat</Link>
                    <TombolBatalKas id={b.id} ringkasan={`${tanggalPendek(b.tanggal)}, ${b.keterangan}, ${formatRupiah(b.jumlah)}`} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Layar lebar: tabel. Kolom penentu (tanggal, keterangan, jumlah) di depan. */}
            <div className="surface mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="border-b border-forest-900/10 bg-forest-50/70 text-left text-xs text-ink-500">
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Keterangan</th>
                    <th className="px-4 py-3 text-right font-semibold">Jumlah</th>
                    <th className="px-4 py-3 font-semibold">Dana</th>
                    <th className="px-4 py-3 font-semibold">Pencatat</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-900/10">
                  {lap.baris.map((b) => (
                    <tr key={b.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-500">{tanggalPendek(b.tanggal)}</td>
                      <td className="px-4 py-3">
                        <span className="text-forest-900">{b.keterangan}</span>
                        <span className="meta block">{b.kategori || TANPA_KATEGORI}</span>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${b.jenis === "masuk" ? "text-forest-700" : "text-red-700"}`}>
                        {b.jenis === "masuk" ? "+" : "−"}{formatRupiah(b.jumlah)}
                      </td>
                      <td className="px-4 py-3 text-ink-500">{b.dana}</td>
                      <td className="px-4 py-3 text-ink-500">
                        {b.pencatat}
                        <span className="meta block">{b.sumber === "telegram" ? "Telegram" : "Panel"}</span>
                      </td>
                      <td className="px-4 py-1">
                        <div className="flex flex-wrap items-center justify-end gap-x-3">
                          {b.bukti && <a href={b.bukti} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center text-forest-700 hover:text-forest-600">Bukti</a>}
                          <Link href={`/admin/kas/${b.id}/edit`} className="inline-flex min-h-11 items-center text-forest-700 hover:text-forest-600">Koreksi</Link>
                          <Link href={`/admin/kas/${b.id}/riwayat`} className="inline-flex min-h-11 items-center text-forest-700 hover:text-forest-600">Riwayat</Link>
                          <TombolBatalKas id={b.id} ringkasan={`${tanggalPendek(b.tanggal)}, ${b.keterangan}, ${formatRupiah(b.jumlah)}`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <GrafikBulanan
          judul={`Pemasukan dan pengeluaran per bulan, ${filter.dana || "semua dana"}`}
          data={lap.bulanan.map((b) => {
            const dari = b.bulan === filter.dari.slice(0, 7) ? filter.dari : `${b.bulan}-01`;
            const akhir = akhirBulan(`${b.bulan}-01`);
            return { ...b, label: labelBulan(b.bulan), href: tautan({ dari, sampai: akhir < filter.sampai ? akhir : filter.sampai }) };
          })}
        />
        <div className="surface p-5 sm:p-6">
          <h2 className="section-title">Ke mana dan dari mana uangnya?</h2>
          <p className="mt-1 text-sm text-ink-500">Per kategori, {cakupan}. Klik kategori untuk melihat transaksinya.</p>
          {lap.kategori.length === 0 ? (
            <p className="mt-6 text-sm text-ink-500">Belum ada transaksi pada periode ini.</p>
          ) : (
            (["masuk", "keluar"] as const).map((jenis) => {
              const daftar = lap.kategori.filter((k) => k.jenis === jenis);
              if (daftar.length === 0) return null;
              const total = jenis === "masuk" ? r.masuk : r.keluar;
              return (
                <div key={jenis} className="mt-5">
                  <h3 className="text-sm font-semibold text-forest-900">{jenis === "masuk" ? "Pemasukan" : "Pengeluaran"} {formatRupiah(total)}</h3>
                  <ul className="mt-2 space-y-2">
                    {daftar.map((k) => (
                      <li key={k.kategori}>
                        <Link href={tautan({ jenis, kategori: k.kategori })} className="block rounded-lg px-2 py-1.5 hover:bg-forest-50">
                          <span className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-forest-900">{k.kategori} <span className="meta">({k.jumlahBaris})</span></span>
                            <span className="tabular-nums text-ink-500">{formatRupiah(k.total)}</span>
                          </span>
                          <span className="mt-1 block h-1.5 rounded-full bg-forest-900/10">
                            <span className={`block h-full rounded-full ${jenis === "masuk" ? "bg-forest-600" : "bg-red-700"}`} style={{ width: `${total ? Math.max(2, (k.total / total) * 100) : 0}%` }} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
