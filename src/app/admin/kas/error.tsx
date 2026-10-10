"use client";

/**
 * Bila data kas gagal dimuat, tampilkan kegagalannya. Jangan pernah jatuh ke
 * angka nol, karena saldo nol yang keliru lebih menyesatkan daripada pesan galat.
 */
export default function GalatKas({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="surface max-w-xl p-6">
      <h1 className="section-title">Buku kas gagal dimuat</h1>
      <p className="mt-2 text-sm text-ink-500">
        Data transaksi tidak berhasil diambil dari server, jadi saldo tidak ditampilkan. Periksa koneksi, lalu coba lagi.
      </p>
      <button type="button" onClick={reset} className="btn btn-primary mt-4 min-h-11">
        Coba lagi
      </button>
    </div>
  );
}
