"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Nonaktifkan atau aktifkan kembali satu slide. Slide tidak pernah dihapus. */
export default function TombolAktifSlide({ id, aktif, judul }: { id: string; aktif: boolean; judul: string }) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function ubah() {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/admin/tv/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktif: !aktif }),
      });
      if (!res.ok) {
        setGalat("Gagal mengubah status. Coba lagi.");
        return;
      }
      router.refresh();
    } catch {
      setGalat("Server tidak dapat dihubungi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={ubah}
        disabled={sibuk}
        aria-label={`${aktif ? "Nonaktifkan" : "Aktifkan"} ${judul}`}
        className={`inline-flex min-h-11 items-center px-1 text-sm disabled:opacity-50 ${aktif ? "text-red-700 hover:text-red-800" : "text-forest-700 hover:text-forest-600"}`}
      >
        {sibuk ? "Menyimpan..." : aktif ? "Nonaktifkan" : "Aktifkan"}
      </button>
      {galat && <span role="alert" className="text-xs text-red-700">{galat}</span>}
    </span>
  );
}
