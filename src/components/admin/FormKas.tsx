"use client";

import { useState } from "react";
import {
  AksiForm,
  KolomTeks,
  PesanFormBox,
  useSimpanForm,
} from "@/components/admin/FormAdmin";
import { KartuAdmin, KepalaAdmin } from "@/components/admin/AdminShell";
import BerkasUnggah from "@/components/admin/BerkasUnggah";
import { formatRupiah } from "@/lib/format";

type JenisKas = "masuk" | "keluar";

export interface NilaiKas {
  tanggal: string;
  jenis: JenisKas;
  kategori: string;
  keterangan: string;
  jumlah: string;
  dana: string;
  bukti: string | null;
}

export const KATEGORI_PEMBUKAAN = "Saldo pembukaan";

/**
 * Formulir catat/koreksi transaksi. Data awal dan daftar dana dikirim dari
 * server sehingga formulir tidak pernah tampil setengah kosong. Koreksi wajib
 * beralasan karena alasan itu masuk riwayat audit.
 */
export default function FormKas({
  id,
  awal,
  dana,
  kategori,
}: {
  id?: string;
  awal: NilaiKas;
  dana: string[];
  kategori: string[];
}) {
  const modeEdit = Boolean(id);
  const { menyimpan, pesan, simpan, router } = useSimpanForm();
  const [data, setData] = useState<NilaiKas>(awal);
  const [alasan, setAlasan] = useState("");
  const [pembukaan, setPembukaan] = useState(awal.kategori === KATEGORI_PEMBUKAAN);
  const angka = /^\d+$/.test(data.jumlah) ? Number(data.jumlah) : null;

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const isi = pembukaan ? { ...data, jenis: "masuk", kategori: KATEGORI_PEMBUKAAN } : data;
    await simpan({
      url: modeEdit ? `/api/admin/kas/${id}` : "/api/admin/kas",
      method: modeEdit ? "PUT" : "POST",
      body: modeEdit ? { ...isi, alasan } : isi,
      suksesUrl: "/admin/kas",
      pesanSukses: modeEdit ? "Koreksi tersimpan." : "Transaksi dicatat.",
    });
  }

  return (
    <div className="max-w-3xl">
      <KepalaAdmin
        kicker="Keuangan"
        judul={modeEdit ? "Koreksi Transaksi" : "Catat Transaksi"}
        keterangan={
          modeEdit
            ? "Nilai lama dan alasan koreksi tersimpan di riwayat transaksi ini."
            : "Jumlah selalu positif. Arah uang ditentukan oleh pilihan pemasukan atau pengeluaran."
        }
      />

      <PesanFormBox pesan={pesan} />

      <form onSubmit={kirim} className="mt-8">
        <KartuAdmin className="space-y-6 p-5 sm:p-6 lg:p-8">
          {!modeEdit && (
            <label className="flex min-h-11 items-start gap-3 rounded-lg border border-forest-900/10 bg-forest-50/60 p-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-forest-700" checked={pembukaan} onChange={(e) => setPembukaan(e.target.checked)} />
              <span>
                <span className="font-medium text-forest-900">Ini saldo pembukaan</span>
                <span className="block text-ink-500">
                  Pakai sekali per dana untuk mencatat uang yang sudah ada sebelum sistem ini dipakai. Tercatat sebagai pemasukan berkategori &quot;{KATEGORI_PEMBUKAAN}&quot;.
                </span>
              </span>
            </label>
          )}

          {!pembukaan && (
            <fieldset>
              <legend className="field-label">Jenis transaksi</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["masuk", "keluar"] as const).map((j) => (
                  <label
                    key={j}
                    className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-700 ${
                      data.jenis === j
                        ? j === "masuk" ? "border-forest-700 bg-forest-700 text-paper" : "border-red-700 bg-red-700 text-white"
                        : "border-forest-900/15 bg-white/80 text-forest-900 hover:bg-forest-50"
                    }`}
                  >
                    <input type="radio" name="jenis" value={j} checked={data.jenis === j} onChange={() => setData({ ...data, jenis: j })} className="sr-only" />
                    {j === "masuk" ? "Pemasukan" : "Pengeluaran"}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="jumlah" className="field-label">Jumlah (Rp)</label>
              <input
                id="jumlah"
                inputMode="numeric"
                pattern="[0-9]*"
                className="field min-h-11 tabular-nums"
                value={data.jumlah}
                onChange={(e) => setData({ ...data, jumlah: e.target.value.replace(/\D/g, "") })}
                placeholder="350000"
                required
                maxLength={10}
                aria-describedby="jumlah-baca"
              />
              <p id="jumlah-baca" className="meta mt-1.5" aria-live="polite">
                {angka ? `Terbaca: ${formatRupiah(angka)}` : "Angka saja, tanpa titik atau koma."}
              </p>
            </div>
            <KolomTeks id="tanggal" type="date" label="Tanggal transaksi" nilai={data.tanggal} onUbah={(v) => setData({ ...data, tanggal: v })} wajib />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="dana" className="field-label">Dana</label>
              <select id="dana" className="field min-h-11" value={data.dana} onChange={(e) => setData({ ...data, dana: e.target.value })} required>
                {!dana.includes(data.dana) && <option value={data.dana}>{data.dana || "Pilih dana"}</option>}
                {dana.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <p className="meta mt-1.5">Daftar dana diatur di halaman Kelola dana.</p>
            </div>
            {!pembukaan && (
              <div>
                <label htmlFor="kategori" className="field-label">Kategori</label>
                <input id="kategori" list="daftar-kategori" className="field min-h-11" value={data.kategori} maxLength={80} placeholder="Contoh: Infak Jumat, Listrik" onChange={(e) => setData({ ...data, kategori: e.target.value })} />
                <datalist id="daftar-kategori">{kategori.map((k) => <option key={k} value={k} />)}</datalist>
              </div>
            )}
          </div>

          <KolomTeks id="keterangan" label="Keterangan" nilai={data.keterangan} onUbah={(v) => setData({ ...data, keterangan: v })} placeholder="Contoh: Infak kotak amal Jumat pekan kedua" wajib maks={200} />

          <BerkasUnggah
            folder="bukti"
            label="Bukti (opsional)"
            value={data.bukti}
            onChange={(url) => setData({ ...data, bukti: url })}
            petunjuk="Foto nota atau bukti transfer, maksimal 5 MB. Hanya admin dan bendahara yang bisa membukanya."
          />

          {modeEdit && (
            <div>
              <label htmlFor="alasan" className="field-label">Alasan koreksi</label>
              <textarea id="alasan" className="field" rows={2} required minLength={5} maxLength={300} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Contoh: nominal salah ketik, seharusnya 350.000" />
            </div>
          )}

          <AksiForm menyimpan={menyimpan} labelSimpan={modeEdit ? "Simpan koreksi" : "Catat transaksi"} onBatal={() => router.push("/admin/kas")} />
        </KartuAdmin>
      </form>
    </div>
  );
}
