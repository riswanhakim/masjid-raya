"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JadwalHarian } from "@/lib/waktu";
import type { DataSlide, RingkasanKasTv } from "./SlideTayangan";

/**
 * Paket tayangan untuk layar TV, termasuk ketahanan offline (PRD OFF-01).
 *
 * - Konten diambil ulang tiap 30 detik, sehingga perubahan terlihat paling
 *   lambat sekitar satu menit setelah disimpan.
 * - Paket terakhir yang berhasil disimpan di localStorage. Bila internet
 *   putus, layar memakai paket itu dan masa tayang tetap dievaluasi dengan jam
 *   perangkat, jadi slide kedaluwarsa tetap keluar.
 * - Jadwal shalat disimpan untuk tujuh hari. Bila hari berganti saat offline,
 *   jadwal diambil dari paket itu; bila tanggalnya tidak ada, layar memberi
 *   tahu jadwal belum tersedia, tidak memakai jadwal kemarin.
 * - Hanya data publik yang disimpan. Panel admin dan bukti tidak pernah masuk.
 */

export interface SlideTv extends DataSlide {
  mulai: string;
  selesai: string;
  durasi: number;
  urutan: number;
}

interface PaketKonten {
  slides: SlideTv[];
  finance: RingkasanKasTv | null;
  jedaAyatDetik: number;
  updatedAt: string;
  versi?: string;
}

interface PaketJadwal {
  lokasi: string;
  jadwal: JadwalHarian[];
}

const KUNCI_KONTEN = "tv-paket-konten";
const KUNCI_JADWAL = "tv-paket-jadwal";
const JEDA_SINKRON_MS = 30_000;
const JEDA_JADWAL_MS = 30 * 60_000;

function baca<T>(kunci: string): T | null {
  try {
    const mentah = localStorage.getItem(kunci);
    return mentah ? (JSON.parse(mentah) as T) : null;
  } catch {
    return null;
  }
}

function simpan(kunci: string, nilai: unknown) {
  try {
    localStorage.setItem(kunci, JSON.stringify(nilai));
  } catch {
    // Penyimpanan penuh atau diblokir: layar tetap jalan dengan data di memori.
  }
}

/**
 * Minta service worker membuang aset lama yang tidak dipakai paket sekarang,
 * agar penyimpanan TV tidak terus membengkak.
 */
function pangkasCache(pola: string, simpan: string[]) {
  navigator.serviceWorker?.controller?.postMessage({ jenis: "pangkas", pola, simpan: simpan.map((u) => new URL(u, location.origin).href) });
}

/** Minta service worker memuat aset ke cache agar tersedia saat offline. */
async function hangatkanCache(urls: string[]): Promise<{ siap: number; total: number }> {
  // Hanya aset dari server sendiri; suara dari situs lain tidak dijanjikan offline.
  const unik = [...new Set(urls.filter((u) => u.startsWith("/")))];
  let siap = 0;
  await Promise.all(
    unik.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok) siap += 1;
      } catch {
        // Aset ini belum siap offline; dihitung sebagai belum siap.
      }
    })
  );
  return { siap, total: unik.length };
}

export interface StatusSinkron {
  online: boolean;
  /** Waktu paket konten terakhir berhasil diambil dari server (ISO). */
  terakhirSinkron: string | null;
  hariJadwalTersimpan: number;
  aset: { siap: number; total: number };
  swAktif: boolean;
}

export function usePaketTv(lokasi: string, audioLokal: string[]) {
  const [konten, setKonten] = useState<PaketKonten | null>(null);
  const [paketJadwal, setPaketJadwal] = useState<PaketJadwal | null>(null);
  const [status, setStatus] = useState<StatusSinkron>({ online: true, terakhirSinkron: null, hariJadwalTersimpan: 0, aset: { siap: 0, total: 0 }, swAktif: false });
  const asetTerakhir = useRef("");
  const versiAwal = useRef<string | null>(null);
  const [versiBaru, setVersiBaru] = useState(false);

  useEffect(() => {
    const k = baca<PaketKonten>(KUNCI_KONTEN);
    if (k) {
      setKonten(k);
      setStatus((s) => ({ ...s, terakhirSinkron: k.updatedAt }));
    }
    const j = baca<PaketJadwal>(KUNCI_JADWAL);
    if (j && j.lokasi === lokasi) {
      setPaketJadwal(j);
      setStatus((s) => ({ ...s, hariJadwalTersimpan: j.jadwal.length }));
    }
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(async () => {
          // Aset halaman ini termuat sebelum service worker aktif, jadi muat
          // ulang sekali lewat service worker agar halaman bisa dibuka offline.
          await new Promise((r) => setTimeout(r, 1000));
          const aset = performance
            .getEntriesByType("resource")
            .map((e) => new URL(e.name))
            .filter((u) => u.origin === location.origin && /^\/(_next\/static|fonts|audio)\//.test(u.pathname))
            .map((u) => u.pathname + u.search);
          const hasil = await hangatkanCache(["/", ...aset]);
          setStatus((s) => ({ ...s, swAktif: hasil.siap === hasil.total }));
          pangkasCache("^/_next/static/", aset);
          // Gambar paket mungkin sudah diambil sebelum service worker aktif;
          // panaskan ulang supaya benar-benar tersimpan.
          asetTerakhir.current = "";
          void sinkronRef.current?.();
        })
        .catch(() => undefined);
    }
  }, [lokasi]);

  const sinkronKonten = useCallback(async () => {
    try {
      const res = await fetch("/api/tv", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as PaketKonten;
      if (data.versi) {
        if (versiAwal.current === null) versiAwal.current = data.versi;
        else if (data.versi !== versiAwal.current) setVersiBaru(true);
      }
      // Foto dan suara paket baru dimuat dulu, baru paket diganti, sehingga
      // slide baru tidak tampil dengan gambar kosong bila koneksi putus.
      const aset = [...data.slides.map((s) => s.gambar ?? ""), ...audioLokal];
      const kunciAset = aset.join("|");
      if (kunciAset !== asetTerakhir.current) {
        const hasil = await hangatkanCache(aset);
        asetTerakhir.current = kunciAset;
        setStatus((s) => ({ ...s, aset: hasil }));
        pangkasCache("^/(api/media/(tayangan|kegiatan|berita|adzan)/|audio/)", aset.filter((u) => u.startsWith("/")));
      }
      setKonten(data);
      simpan(KUNCI_KONTEN, data);
      setStatus((s) => ({ ...s, online: true, terakhirSinkron: data.updatedAt }));
    } catch {
      setStatus((s) => ({ ...s, online: false }));
    }
  }, [audioLokal]);
  const sinkronRef = useRef<(() => Promise<void>) | null>(null);
  sinkronRef.current = sinkronKonten;

  const sinkronJadwal = useCallback(async () => {
    try {
      const res = await fetch(`/api/jadwal?hari=7&lokasi=${encodeURIComponent(lokasi)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as PaketJadwal;
      if (!Array.isArray(data.jadwal) || data.jadwal.length === 0) return;
      const paket = { lokasi, jadwal: data.jadwal };
      setPaketJadwal(paket);
      simpan(KUNCI_JADWAL, paket);
      setStatus((s) => ({ ...s, hariJadwalTersimpan: data.jadwal.length }));
    } catch {
      // Tetap pakai paket jadwal tersimpan.
    }
  }, [lokasi]);

  useEffect(() => {
    void sinkronKonten();
    void sinkronJadwal();
    const t1 = window.setInterval(sinkronKonten, JEDA_SINKRON_MS);
    const t2 = window.setInterval(sinkronJadwal, JEDA_JADWAL_MS);
    const kembaliOnline = () => {
      void sinkronKonten();
      void sinkronJadwal();
    };
    const putus = () => setStatus((s) => ({ ...s, online: false }));
    window.addEventListener("online", kembaliOnline);
    window.addEventListener("offline", putus);
    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
      window.removeEventListener("online", kembaliOnline);
      window.removeEventListener("offline", putus);
    };
  }, [sinkronKonten, sinkronJadwal]);

  /** Jumlah hari jadwal tersimpan mulai tanggal ini (hari yang sudah lewat tidak dihitung). */
  const hariTersedia = useCallback(
    (tanggal: string) => paketJadwal?.jadwal.filter((j) => j.tanggal >= tanggal).length ?? 0,
    [paketJadwal]
  );

  /** Jadwal untuk tanggal tertentu dari paket tersimpan, atau null bila tidak ada. */
  const jadwalUntuk = useCallback(
    (tanggal: string) => paketJadwal?.jadwal.find((j) => j.tanggal === tanggal) ?? null,
    [paketJadwal]
  );

  return { konten, status, jadwalUntuk, hariTersedia, sinkronJadwal, versiBaru };
}
