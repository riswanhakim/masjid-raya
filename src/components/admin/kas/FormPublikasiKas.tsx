"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PERIODE = [
  { nilai: "bulan_ini", label: "Bulan berjalan", keterangan: "Saldo awal bulan, pemasukan dan pengeluaran bulan ini, saldo akhir." },
  { nilai: "tahun_ini", label: "Tahun berjalan", keterangan: "Sejak 1 Januari sampai hari ini." },
  { nilai: "semua", label: "Seluruh catatan", keterangan: "Total sejak transaksi pertama." },
];

export default function FormPublikasiKas({
  awal,
  semuaDana,
}: {
  awal: { aktif: boolean; periode: string; dana: string[] };
  semuaDana: string[];
}) {
  const router = useRouter();
  const [aktif, setAktif] = useState(awal.aktif);
  const [periode, setPeriode] = useState(awal.periode);
  const [dana, setDana] = useState<string[]>(awal.dana);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    setPesan(null);
    try {
      const res = await fetch("/api/pengaturan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { key: "kas_publik", value: String(aktif) },
          { key: "kas_publik_periode", value: periode },
          { key: "kas_publik_dana", value: dana.join("\n") },
        ]),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: { message: string }[] };
      if (!res.ok) {
        setPesan({ ok: false, teks: data.detail?.[0]?.message ?? data.error ?? "Pengaturan gagal disimpan." });
        return;
      }
      setPesan({ ok: true, teks: aktif ? "Tersimpan. Ringkasan kas dipublikasikan; layar TV memperbarui dalam satu menit." : "Tersimpan. Publikasi kas dimatikan." });
      router.refresh();
    } catch {
      setPesan({ ok: false, teks: "Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi." });
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <form onSubmit={simpan} className="surface mt-8 space-y-6 p-5 sm:p-6">
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-forest-700" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
        <span>
          <span className="font-medium text-forest-900">Publikasikan ringkasan kas</span>
          <span className="block text-sm text-ink-500">Bila mati, halaman Laporan Kas dan slide kas di TV tidak menampilkan angka apa pun.</span>
        </span>
      </label>

      <fieldset disabled={!aktif} className="space-y-6 disabled:opacity-60">
        <fieldset>
          <legend className="field-label">Periode yang ditampilkan</legend>
          <div className="space-y-2">
            {PERIODE.map((p) => (
              <label key={p.nilai} className="flex min-h-11 items-start gap-3 rounded-lg border border-forest-900/10 p-3">
                <input type="radio" name="periode" className="mt-1 accent-forest-700" value={p.nilai} checked={periode === p.nilai} onChange={() => setPeriode(p.nilai)} />
                <span className="text-sm"><span className="font-medium text-forest-900">{p.label}</span><span className="block text-ink-500">{p.keterangan}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="field-label">Dana yang disertakan</legend>
          <p className="mb-2 text-sm text-ink-500">Biarkan semua tidak dicentang untuk menyertakan seluruh dana.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {semuaDana.map((d) => (
              <label key={d} className="flex min-h-11 items-center gap-3 rounded-lg border border-forest-900/10 px-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-forest-700"
                  checked={dana.includes(d)}
                  onChange={(e) => setDana(e.target.checked ? [...dana, d] : dana.filter((x) => x !== d))}
                />
                <span className="text-sm text-forest-900">{d}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>

      {pesan && (
        <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${pesan.ok ? "border-forest-500/40 bg-forest-50 text-forest-800" : "border-red-300/60 bg-red-50 text-red-700"}`}>
          {pesan.teks}
        </p>
      )}

      <button type="submit" disabled={menyimpan} className="btn btn-primary min-h-11 disabled:opacity-50">
        {menyimpan ? "Menyimpan..." : "Simpan pengaturan publikasi"}
      </button>
    </form>
  );
}
