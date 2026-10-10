"use client";

import { useState } from "react";
import Link from "next/link";

interface Bulan {
  bulan: string;
  label: string;
  masuk: number;
  keluar: number;
  href: string;
}

const rp = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(n)}`;
const ringkas = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M` :
  n >= 1e6 ? `${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` :
  n >= 1e3 ? `${Math.round(n / 1e3).toLocaleString("id-ID")} rb` : String(n);

/** Angka sumbu yang bulat: 1, 2, 2,5, atau 5 kali pangkat sepuluh. */
function batasAtas(maks: number) {
  if (maks <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(maks));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= maks)!;
}

// Warna seri divalidasi skrip dataviz (masuk #0b8353, keluar #b91c1c).
// Pasangan ini hanya 6,8 ΔE untuk deuteranopia, jadi pengeluaran juga diberi
// arsiran sebagai penanda kedua selain warna.
const WARNA = { masuk: "#0b8353", keluar: "#b91c1c" };

/**
 * Kolom berpasangan pemasukan/pengeluaran per bulan. Setiap pasangan bisa
 * difokus (Tab) atau disorot untuk melihat angka, dan diklik untuk membuka
 * transaksi bulan itu, sehingga angka grafik bisa ditelusuri ke transaksinya.
 */
export default function GrafikBulanan({ data, judul }: { data: Bulan[]; judul: string }) {
  const [aktif, setAktif] = useState<number | null>(null);
  const maks = batasAtas(Math.max(0, ...data.flatMap((d) => [d.masuk, d.keluar])));
  const T = 180;
  const slot = 56;
  const lebar = Math.max(data.length * slot, 280);
  const batang = Math.min(20, slot / 2 - 6);
  const y = (n: number) => T - (n / maks) * T;
  const ticks = [0, maks / 2, maks];
  const kosong = data.every((d) => d.masuk === 0 && d.keluar === 0);
  const sorot = aktif !== null ? data[aktif] : null;

  return (
    <figure className="surface p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="section-title">{judul}</h2>
        <span className="flex items-center gap-4 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: WARNA.masuk }} />Pemasukan</span>
          <span className="inline-flex items-center gap-1.5">
            {/* Pola arsir didefinisikan di sini agar selalu ada, juga saat grafik kosong. */}
            <svg width="10" height="10" aria-hidden="true">
              <defs>
                <pattern id="arsir-keluar" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="5" height="5" fill={WARNA.keluar} />
                  <line x1="0" y1="0" x2="0" y2="5" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.6" />
                </pattern>
              </defs>
              <rect width="10" height="10" rx="2" fill="url(#arsir-keluar)" />
            </svg>
            Pengeluaran
          </span>
        </span>
      </figcaption>

      {kosong ? (
        <p className="mt-6 text-sm text-ink-500">Tidak ada transaksi pada periode dan dana ini, jadi grafik belum bisa digambar.</p>
      ) : (
        <>
          <p className="mt-3 min-h-5 text-sm text-ink-500" aria-live="polite">
            {sorot
              ? <>{sorot.label}: masuk <strong className="text-forest-900">{rp(sorot.masuk)}</strong>, keluar <strong className="text-forest-900">{rp(sorot.keluar)}</strong>. Klik untuk melihat transaksinya.</>
              : "Sorot atau fokus satu bulan untuk melihat angkanya."}
          </p>
          <div className="mt-3 overflow-x-auto">
            <svg viewBox={`-44 -8 ${lebar + 52} ${T + 34}`} width={lebar + 52} height={T + 34} role="img" aria-label={judul} className="block max-w-none">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={0} x2={lebar} y1={y(t)} y2={y(t)} stroke="#dce8e1" strokeWidth={1} />
                  <text x={-8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#4f705f">{ringkas(t)}</text>
                </g>
              ))}
              {data.map((d, i) => {
                const x = i * slot + slot / 2;
                const tinggiMasuk = T - y(d.masuk);
                const tinggiKeluar = T - y(d.keluar);
                return (
                  <Link
                    key={d.bulan}
                    href={d.href}
                    onMouseEnter={() => setAktif(i)}
                    onMouseLeave={() => setAktif(null)}
                    onFocus={() => setAktif(i)}
                    onBlur={() => setAktif(null)}
                    aria-label={`${d.label}: masuk ${rp(d.masuk)}, keluar ${rp(d.keluar)}. Buka transaksinya.`}
                    className="outline-none [&:focus-visible>rect:first-child]:stroke-forest-700"
                  >
                    <rect x={x - slot / 2 + 2} y={-6} width={slot - 4} height={T + 8} rx={6} fill={aktif === i ? "#eafaf1" : "transparent"} stroke="transparent" strokeWidth={2} />
                    {tinggiMasuk > 0 && <path d={kolom(x - batang - 1, T, batang, tinggiMasuk)} fill={WARNA.masuk} />}
                    {tinggiKeluar > 0 && <path d={kolom(x + 1, T, batang, tinggiKeluar)} fill="url(#arsir-keluar)" />}
                    <text x={x} y={T + 18} textAnchor="middle" fontSize="11" fill="#3b5a4b">{d.label}</text>
                  </Link>
                );
              })}
              <line x1={0} x2={lebar} y1={T} y2={T} stroke="#9fb5aa" strokeWidth={1} />
            </svg>
          </div>
        </>
      )}

      <details className="mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-forest-700">Lihat sebagai tabel</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead><tr className="text-left text-ink-500"><th className="py-2 pr-4 font-medium">Bulan</th><th className="py-2 pr-4 text-right font-medium">Pemasukan</th><th className="py-2 text-right font-medium">Pengeluaran</th></tr></thead>
            <tbody className="divide-y divide-forest-900/10">
              {data.map((d) => (
                <tr key={d.bulan}><td className="py-2 pr-4"><Link className="link-hairline" href={d.href}>{d.label}</Link></td><td className="py-2 pr-4 text-right tabular-nums">{rp(d.masuk)}</td><td className="py-2 text-right tabular-nums">{rp(d.keluar)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Kolom dengan ujung atas membulat 4px dan dasar persegi. */
function kolom(x: number, dasar: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2);
  const atas = dasar - h;
  return `M${x},${dasar} V${atas + r} Q${x},${atas} ${x + r},${atas} H${x + w - r} Q${x + w},${atas} ${x + w},${atas + r} V${dasar} Z`;
}
