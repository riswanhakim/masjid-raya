"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Dana {
  id: string;
  nama: string;
  aktif: boolean;
  transaksi: number;
}

export default function KelolaDana({ awal }: { awal: Dana[] }) {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  async function kirim(url: string, method: string, body: object, berhasil: string) {
    setPesan(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: { message: string }[] };
      if (!res.ok) {
        setPesan({ ok: false, teks: data.detail?.[0]?.message ?? data.error ?? "Perubahan gagal disimpan. Coba lagi." });
        return false;
      }
      setPesan({ ok: true, teks: berhasil });
      router.refresh();
      return true;
    } catch {
      setPesan({ ok: false, teks: "Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi." });
      return false;
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <form
        className="surface flex flex-wrap items-end gap-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setSibuk("baru");
          if (await kirim("/api/admin/kas/dana", "POST", { nama }, `Dana "${nama.trim()}" ditambahkan.`)) setNama("");
          setSibuk(null);
        }}
      >
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="nama-dana" className="field-label">Nama dana baru</label>
          <input id="nama-dana" className="field min-h-11" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={80} placeholder="Contoh: Qurban 1448 H" />
        </div>
        <button type="submit" disabled={sibuk === "baru"} className="btn btn-primary min-h-11 disabled:opacity-50">
          {sibuk === "baru" ? "Menambahkan..." : "Tambah dana"}
        </button>
      </form>

      {pesan && (
        <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${pesan.ok ? "border-forest-500/40 bg-forest-50 text-forest-800" : "border-red-300/60 bg-red-50 text-red-700"}`}>
          {pesan.teks}
        </p>
      )}

      {awal.length === 0 ? (
        <p className="text-sm text-ink-500">Belum ada dana. Tambahkan minimal satu dana, misalnya Operasional, sebelum mencatat transaksi.</p>
      ) : (
        <ul className="surface divide-y divide-forest-900/10">
          {awal.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className={`font-medium ${d.aktif ? "text-forest-900" : "text-ink-500"}`}>{d.nama}{!d.aktif && " (nonaktif)"}</p>
                <p className="meta">{d.transaksi} transaksi aktif</p>
              </div>
              <button
                type="button"
                disabled={sibuk === d.id}
                onClick={async () => {
                  setSibuk(d.id);
                  await kirim(`/api/admin/kas/dana/${d.id}`, "PATCH", { aktif: !d.aktif }, d.aktif ? `Dana "${d.nama}" dinonaktifkan. Transaksi lamanya tetap dihitung.` : `Dana "${d.nama}" aktif kembali.`);
                  setSibuk(null);
                }}
                className="btn btn-outline min-h-11 disabled:opacity-50"
              >
                {d.aktif ? "Nonaktifkan" : "Aktifkan kembali"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
