"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Pembatalan transaksi dengan alasan wajib. Transaksi tidak dihapus: ia
 * keluar dari perhitungan saldo, sementara alasan dan nilai lamanya tersimpan
 * di riwayat audit. Memakai <dialog> bawaan sehingga Escape menutupnya.
 */
export default function TombolBatalKas({ id, ringkasan }: { id: string; ringkasan: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setGalat(null);
    setMengirim(true);
    try {
      const res = await fetch(`/api/admin/kas/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alasan }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: { message: string }[] };
        setGalat(data.detail?.[0]?.message ?? data.error ?? "Transaksi gagal dibatalkan. Coba lagi.");
        return;
      }
      dialog.current?.close();
      router.refresh();
    } catch {
      setGalat("Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi.");
    } finally {
      setMengirim(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setAlasan(""); setGalat(null); dialog.current?.showModal(); }}
        className="inline-flex min-h-11 items-center px-1 text-sm text-red-700 transition hover:text-red-800"
      >
        Batalkan
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`judul-batal-${id}`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-forest-900/15 bg-paper p-0 text-ink backdrop:bg-forest-950/40"
      >
        <form onSubmit={kirim} className="space-y-4 p-6">
          <h2 id={`judul-batal-${id}`} className="section-title">Batalkan transaksi?</h2>
          <p className="text-sm text-ink-500">{ringkasan}</p>
          <p className="text-sm text-ink-500">
            Transaksi akan keluar dari perhitungan saldo. Catatannya tetap tersimpan di riwayat beserta alasan Anda.
          </p>
          <div>
            <label htmlFor={`alasan-${id}`} className="field-label">Alasan pembatalan</label>
            <textarea
              id={`alasan-${id}`}
              className="field"
              rows={3}
              required
              minLength={5}
              maxLength={300}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: tercatat dua kali dari Telegram"
            />
          </div>
          {galat && <p role="alert" className="text-sm text-red-700">{galat}</p>}
          <div className="flex flex-wrap gap-3 border-t border-forest-900/10 pt-4">
            <button type="submit" disabled={mengirim} className="btn min-h-11 bg-red-700 text-white hover:bg-red-800 disabled:opacity-50">
              {mengirim ? "Membatalkan..." : "Ya, batalkan transaksi"}
            </button>
            <button type="button" onClick={() => dialog.current?.close()} className="btn btn-outline min-h-11">
              Kembali
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
