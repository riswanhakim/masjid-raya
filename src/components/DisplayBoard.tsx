"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import LogoMasjid from "@/components/LogoMasjid";
import AyatShowcase from "@/components/AyatShowcase";
import KreditAplikasi from "@/components/KreditAplikasi";
import SlideTayangan from "@/components/tv/SlideTayangan";
import { LayarShalat, StatusOperator } from "@/components/tv/PanelTv";
import { usePaketTv, type SlideTv } from "@/components/tv/usePaketTv";
import { slideBerlaku } from "@/lib/tv";
import {
  IkonLayarPenuh,
  IkonKeluarLayarPenuh,
  IkonSuara,
} from "@/components/Ikon";
import type { Ayat } from "@/lib/ayat";
import { cariSurah, type InfoSurah } from "@/lib/surah";
import { LABEL_ZONA, ZONA_DEFAULT, type Zona } from "@/lib/kota";
import {
  detikHari,
  kunciTanggal,
  URUTAN_SHALAT,
  type JadwalHarian,
} from "@/lib/waktu";
import {
  formatDurasi,
  ringkasPapan,
  type RingkasanPapan,
} from "@/lib/papan";

const NAVIGASI = [
  { href: "/jadwal", label: "Jadwal Shalat" },
  { href: "/khutbah", label: "Khutbah" },
  { href: "/kegiatan", label: "Kegiatan" },
  { href: "/berita", label: "Berita" },
  { href: "/galeri", label: "Galeri" },
  { href: "/petugas", label: "Petugas" },
  { href: "/kas", label: "Laporan Kas" },
  { href: "/profil", label: "Profil" },
];

const JEDA_SEGARKAN_MS = 5 * 60 * 1000;

interface DisplayBoardProps {
  namaMasjid: string;
  alamat: string | null;
  logoMasjid?: string | null;
  jadwalAwal: JadwalHarian | null;
  ringkasanAwal: RingkasanPapan;
  ayat: Ayat[];
  runningText: string;
  reminderMenit: number;
  iqomahMenit: number;
  adzanAktif: boolean;
  adzanAudioUrl: string;
  /** Audio adzan khusus Subuh (memuat lafaz tatswib Ash-shalatu khairum minan-naum). */
  adzanSubuhAudioUrl?: string;
  reminderSuara: boolean;
  tampilkanMurottal: boolean;
  /** Subdirektori EveryAyah reciter murottal pilihan admin (lihat lib/murottal.ts). */
  murottalReciter: string;
  /** Surah penuh untuk mode surah; null berarti mode ayat pilihan. */
  surah: InfoSurah | null;
  /** Surah otomatis maju ke berikutnya setelah tuntas (hingga khatam). */
  surahLanjutOtomatis: boolean;
  /** Jeda murottal setelah adzan selesai (menit); 0 = lanjut segera. */
  murottalJedaMenit: number;
  /** Jendela jam tayang harian HH:MM; "" = tanpa batas. */
  murottalMulai: string;
  murottalSelesai: string;
  /** Penyesuaian tanggal Hijriah (hari) dari pengaturan masjid. */
  hijriahOffsetHari: number;
  /** "menjelang_adzan": murottal hanya sebelum adzan; "jam_tayang": sepanjang jendela tayang. */
  murottalMode: "menjelang_adzan" | "jam_tayang";
  /** Murottal menyala otomatis sekian menit sebelum tiap adzan. */
  murottalPraAdzanMenit: number;
  /** Lama layar "shalat berlangsung" setelah iqomah (menit); 0 = tanpa layar ini. */
  layarShalatMenit: number;
}

/** Nada pengingat lembut memakai Web Audio, tanpa berkas suara eksternal. */
function bunyikanNada() {
  if (typeof window === "undefined") return;
  const Konteks =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Konteks) return;

  try {
    const konteks = new Konteks();
    const mulai = konteks.currentTime;
    [523.25, 659.25, 783.99].forEach((frekuensi, urutan) => {
      const offset = urutan * 0.42;
      const osilator = konteks.createOscillator();
      const penguat = konteks.createGain();
      osilator.type = "sine";
      osilator.frequency.value = frekuensi;
      penguat.gain.setValueAtTime(0.0001, mulai + offset);
      penguat.gain.linearRampToValueAtTime(0.16, mulai + offset + 0.06);
      penguat.gain.exponentialRampToValueAtTime(0.0001, mulai + offset + 0.65);
      osilator.connect(penguat).connect(konteks.destination);
      osilator.start(mulai + offset);
      osilator.stop(mulai + offset + 0.7);
    });
    window.setTimeout(() => konteks.close(), 2500);
  } catch {
    // Suara bersifat tambahan; abaikan bila peramban menolak.
  }
}

export default function DisplayBoard({
  namaMasjid,
  alamat,
  logoMasjid,
  jadwalAwal,
  ringkasanAwal,
  ayat,
  runningText,
  reminderMenit,
  iqomahMenit,
  adzanAktif,
  adzanAudioUrl,
  adzanSubuhAudioUrl,
  reminderSuara,
  tampilkanMurottal,
  murottalReciter,
  surah,
  surahLanjutOtomatis,
  murottalJedaMenit,
  murottalMulai,
  murottalSelesai,
  hijriahOffsetHari,
  murottalMode,
  murottalPraAdzanMenit,
  layarShalatMenit,
}: DisplayBoardProps) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const panelHref = role === "jamaah" ? "/jamaah" : "/admin";

  const [waktu, setWaktu] = useState<Date | null>(null);
  const [jadwal, setJadwal] = useState<JadwalHarian | null>(jadwalAwal);
  const [suaraSiap, setSuaraSiap] = useState(false);
  const [menuTerbuka, setMenuTerbuka] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Tata letak TV dipakai saat layar penuh, atau bila halaman dibuka dengan
  // ?tv=1 (untuk Chrome mode kiosk, dan agar tetap bertahan setelah halaman
  // dimuat ulang otomatis, yang selalu mengeluarkan browser dari layar penuh).
  const [paramTv, setParamTv] = useState(false);
  useEffect(() => {
    setParamTv(new URLSearchParams(window.location.search).get("tv") === "1");
  }, []);
  const modeTv = isFullscreen || paramTv;
  // true selama audio adzan benar-benar berbunyi — murottal ditahan
  // (dijeda) selama itu sebagai adab mendengarkan adzan.
  const [adzanBerbunyi, setAdzanBerbunyi] = useState(false);
  // Tahan lanjutan setelah adzan selesai, selama jeda yang diatur admin
  // (bawaan 30 menit). Dilepas otomatis lewat timer.
  const [jedaLepasAdzan, setJedaLepasAdzan] = useState(false);
  const timerJedaAdzan = useRef<number | null>(null);
  const nadaTerakhir = useRef<string | null>(null);
  const adzanTerakhir = useRef<string | null>(null);
  const audioAdzan = useRef<HTMLAudioElement | null>(null);
  // Penanda masa adzan/iqomah yang terakhir terlihat, untuk mendeteksi
  // momen "baru saja selesai" sebagai pemicu jeda 30 menit.
  const masaAdzanSebelumnya = useRef<string | null>(null);

  // Bersihkan timer jeda bila komponen dilepas.
  useEffect(() => {
    return () => {
      if (timerJedaAdzan.current !== null) {
        window.clearTimeout(timerJedaAdzan.current);
        timerJedaAdzan.current = null;
      }
    };
  }, []);

  // Surah yang sedang diputar di mode surah. Maju otomatis 1→114→1 bila
  // opsi lanjut aktif; diselaraskan ulang bila pengaturan admin berubah.
  const [nomorSurahAktif, setNomorSurahAktif] = useState<number | null>(
    surah?.nomor ?? null
  );
  useEffect(() => {
    setNomorSurahAktif(surah?.nomor ?? null);
  }, [surah?.nomor]);
  const surahAktif =
    (nomorSurahAktif ? cariSurah(nomorSurahAktif) : null) ?? surah;
  const majuSurahBerikutnya = useCallback(() => {
    setNomorSurahAktif((nomor) => (nomor ? (nomor % 114) + 1 : nomor));
  }, []);

  // Deteksi event perubahan fullscreen dari browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        setIsFullscreen(true);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => undefined);
      }
    }
  }, []);

  // Zona waktu mengikuti lokasi jadwal yang sedang tampil (WIB/WITA/WIT).
  const zona: Zona = jadwal?.zona ?? ZONA_DEFAULT;

  useEffect(() => {
    setWaktu(new Date());
    const timer = setInterval(() => setWaktu(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const segarkanJadwal = useCallback(async () => {
    try {
      // Lokasi selalu dari pengaturan masjid.
      const lokasi = jadwalAwal?.lokasi ?? "Jakarta";
      const url = `/api/jadwal?lokasi=${encodeURIComponent(lokasi)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as JadwalHarian;
      if (data && data.lokasi) setJadwal(data);
    } catch {
      // Saat jaringan bermasalah, jadwalTampil memakai paket 7 hari tersimpan.
    }
  }, [jadwalAwal?.lokasi]);

  // Lokasi jadwal selalu mengikuti pengaturan masjid. Deteksi GPS/IP dulu
  // bisa menimpa jadwal (termasuk jadwal manual) dengan kota lain bila
  // perkiraan lokasi jaringan meleset, jadi tidak dipakai di layar TV.

  useEffect(() => {
    const timer = setInterval(segarkanJadwal, JEDA_SEGARKAN_MS);
    return () => clearInterval(timer);
  }, [segarkanJadwal]);

  const tanggalLokal = waktu ? kunciTanggal(waktu, zona) : null;
  const tanggalTerakhir = useRef<string | null>(null);
  useEffect(() => {
    if (!tanggalLokal) return;
    if (tanggalTerakhir.current && tanggalTerakhir.current !== tanggalLokal) {
      void segarkanJadwal();
    }
    tanggalTerakhir.current = tanggalLokal;
  }, [tanggalLokal, segarkanJadwal]);

  const audioLokal = useMemo(
    () => (adzanAktif ? [adzanAudioUrl, adzanSubuhAudioUrl ?? ""].filter((u) => u.startsWith("/")) : []),
    [adzanAktif, adzanAudioUrl, adzanSubuhAudioUrl]
  );
  const { konten, status: statusSinkron, jadwalUntuk, hariTersedia, versiBaru } = usePaketTv(jadwalAwal?.lokasi ?? "Jakarta", audioLokal);

  // Jadwal yang ditampilkan harus untuk tanggal hari ini. Bila server tidak
  // terjangkau saat hari berganti, ambil dari paket 7 hari; bila tidak ada,
  // kosongkan (jangan pakai jadwal kemarin seolah masih berlaku).
  const jadwalTampil = useMemo(() => {
    if (!tanggalLokal) return jadwal;
    if (jadwal && jadwal.tanggal === tanggalLokal) return jadwal;
    return jadwalUntuk(tanggalLokal);
  }, [jadwal, tanggalLokal, jadwalUntuk]);

  const ringkasan = useMemo(
    () =>
      waktu
        ? ringkasPapan(waktu, jadwalTampil, iqomahMenit, zona, hijriahOffsetHari)
        : ringkasanAwal,
    [waktu, jadwalTampil, iqomahMenit, ringkasanAwal, zona, hijriahOffsetHari]
  );

  const detikSekarang = waktu ? detikHari(waktu, zona) : null;
  const menitSekarang = detikSekarang == null ? null : Math.floor(detikSekarang / 60);

  /** Jendela jam tayang murottal; kosong = seharian, mendukung lewat tengah malam. */
  const murottalDalamJendela = useMemo(() => {
    const keMenit = (s: string): number | null => {
      const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const mulai = keMenit(murottalMulai);
    const selesai = keMenit(murottalSelesai);
    if (mulai === null || selesai === null || menitSekarang === null) return true;
    const sekarang = ((menitSekarang % 1440) + 1440) % 1440;
    if (mulai <= selesai) return sekarang >= mulai && sekarang < selesai;
    return sekarang >= mulai || sekarang < selesai;
  }, [murottalMulai, murottalSelesai, menitSekarang]);
  const batasReminder = reminderMenit * 60;
  const dalamPengingat =
    ringkasan.hitungMundur != null &&
    ringkasan.hitungMundur > 0 &&
    ringkasan.hitungMundur <= batasReminder;

  // Adab adzan untuk murottal:
  // - Jeda 5 detik sebelum adzan tiba (antisipasi agar tidak bertabrakan
  //   dengan awal audio adzan akibat drift detik/jadwal).
  // - Tahan selama masa adzan + iqomah (`iqomahKey` non-null).
  // - Tahan lanjutan 30 menit (mengikuti `murottalJedaMenit`) setelah masa
  //   adzan/iqomah dan audio adzan benar-benar selesai, lalu play kembali.
  const PRA_ADZAN_DETIK = 5;
  const praAdzan =
    ringkasan.hitungMundur != null &&
    ringkasan.hitungMundur > 0 &&
    ringkasan.hitungMundur <= PRA_ADZAN_DETIK;
  const masaAdzanIqomah = ringkasan.iqomahKey != null;
  // Murottal otomatis menjelang adzan: dari N menit sebelum adzan sampai jeda
  // 5 detik sebelum adzan (praAdzan) yang menahan murottal.
  const praMurottal =
    tampilkanMurottal &&
    ringkasan.hitungMundur != null &&
    ringkasan.hitungMundur > PRA_ADZAN_DETIK &&
    ringkasan.hitungMundur <= murottalPraAdzanMenit * 60;
  const murottalBerbunyi =
    tampilkanMurottal && (praMurottal || (murottalMode === "jam_tayang" && murottalDalamJendela));

  // Transisi masa adzan/iqomah → selesai: mulai timer jeda pasca-adzan.
  // Selama masa adzan/iqomah atau audio adzan berbunyi: batalkan timer dan
  // tahan (tanpa jeda) agar tidak ada celah murottal sempat menyela.
  useEffect(() => {
    const kunciMasa = ringkasan.iqomahKey;
    if (kunciMasa || adzanBerbunyi) {
      if (kunciMasa) masaAdzanSebelumnya.current = kunciMasa;
      if (timerJedaAdzan.current !== null) {
        window.clearTimeout(timerJedaAdzan.current);
        timerJedaAdzan.current = null;
      }
      setJedaLepasAdzan(false);
      return;
    }
    // Sampai di sini: tidak ada adzan berbunyi dan tidak dalam masa iqomah.
    // Hanya mulai jeda bila baru saja keluar dari masa adzan/iqomah.
    if (masaAdzanSebelumnya.current) {
      masaAdzanSebelumnya.current = null;
      if (murottalJedaMenit > 0) {
        setJedaLepasAdzan(true);
        if (timerJedaAdzan.current !== null) {
          window.clearTimeout(timerJedaAdzan.current);
        }
        timerJedaAdzan.current = window.setTimeout(() => {
          setJedaLepasAdzan(false);
          timerJedaAdzan.current = null;
        }, murottalJedaMenit * 60 * 1000);
      } else {
        setJedaLepasAdzan(false);
      }
    }
  }, [ringkasan.iqomahKey, adzanBerbunyi, murottalJedaMenit]);

  const tahanMurottalAdzan =
    adzanBerbunyi ||
    jedaLepasAdzan ||
    praAdzan ||
    masaAdzanIqomah ||
    // Jembatan antar-render: saat masa adzan baru saja selesai, ref masih
    // menyimpan kunci terakhir sampai efek di atas menaikkan `jedaLepasAdzan`.
    // Tanpa ini ada celah 1 render di mana murottal sempat menyela.
    masaAdzanSebelumnya.current != null;

  // --- Prioritas shalat atas slideshow (PRD TV-02) ---
  // Masuk waktu sampai iqomah: layar penuh hitung mundur. Setelah iqomah:
  // layar "shalat berlangsung" selama layarShalatMenit, lalu papan kembali
  // dan rotasi tayangan lanjut sendiri.
  const [shalatBerlangsung, setShalatBerlangsung] = useState<{ nama: string; sampai: number } | null>(null);
  const iqomahTerakhir = useRef<{ nama: string } | null>(null);
  useEffect(() => {
    if (ringkasan.iqomahKey && ringkasan.iqomahNama) {
      iqomahTerakhir.current = { nama: ringkasan.iqomahNama };
      setShalatBerlangsung(null);
      return;
    }
    if (iqomahTerakhir.current) {
      if (layarShalatMenit > 0) {
        setShalatBerlangsung({ nama: iqomahTerakhir.current.nama, sampai: Date.now() + layarShalatMenit * 60_000 });
      }
      iqomahTerakhir.current = null;
    }
  }, [ringkasan.iqomahKey, ringkasan.iqomahNama, layarShalatMenit]);
  const sedangShalat = !!shalatBerlangsung && !!waktu && waktu.getTime() < shalatBerlangsung.sampai;
  const prioritas = masaAdzanIqomah || adzanBerbunyi || sedangShalat;

  // --- Rotasi tayangan ---
  // Urutan putar: slide yang berlaku sekarang (dievaluasi dengan jam
  // perangkat, juga saat offline), lalu satu giliran panel ayat.
  const putaran = useMemo(() => {
    type Item = { jenis: "slide"; slide: SlideTv } | { jenis: "ayat" };
    if (!konten || !waktu) return [] as Item[];
    const slides = slideBerlaku(konten.slides, waktu).filter((sl) => sl.jenis !== "kas" || konten.finance);
    if (slides.length === 0) return [];
    const daftar: Item[] = slides.map((slide) => ({ jenis: "slide" as const, slide }));
    if (konten.jedaAyatDetik > 0) daftar.push({ jenis: "ayat" as const });
    return daftar;
    // Dihitung ulang tiap menit cukup untuk masa tayang; tidak perlu tiap detik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [konten, menitSekarang]);
  const [posisi, setPosisi] = useState({ indeks: 0, mulai: 0 });
  const itemAktif = putaran.length ? putaran[posisi.indeks % putaran.length] : null;
  useEffect(() => {
    if (!waktu || !itemAktif || prioritas) return;
    const durasi = itemAktif.jenis === "slide" ? itemAktif.slide.durasi : konten?.jedaAyatDetik ?? 60;
    if (posisi.mulai === 0) {
      setPosisi((p) => ({ ...p, mulai: waktu.getTime() }));
    } else if (waktu.getTime() - posisi.mulai >= durasi * 1000) {
      setPosisi((p) => ({ indeks: (p.indeks + 1) % Math.max(1, putaran.length), mulai: waktu.getTime() }));
    }
  }, [waktu, itemAktif, prioritas, posisi.mulai, putaran.length, konten?.jedaAyatDetik]);
  // Menjelang adzan, layar menampilkan ayat yang sedang dilantunkan.
  const slideAktif = !prioritas && !praMurottal && itemAktif?.jenis === "slide" ? itemAktif.slide : null;

  // Layar penuh shalat; operator (bukan mode layar penuh TV) boleh menutupnya
  // untuk masa itu saja.
  const kunciLayarShalat = masaAdzanIqomah
    ? `iqomah-${ringkasan.iqomahKey}-${tanggalLokal}`
    : sedangShalat
      ? `shalat-${shalatBerlangsung?.nama}-${tanggalLokal}`
      : null;
  const [layarDitutup, setLayarDitutup] = useState<string | null>(null);

  // Versi aplikasi baru terpasang: muat ulang halaman, tetapi jangan di
  // tengah murottal menjelang adzan atau saat layar shalat tampil.
  useEffect(() => {
    if (versiBaru && !prioritas && !praMurottal && statusSinkron.online) window.location.reload();
  }, [versiBaru, prioritas, praMurottal, statusSinkron.online]);
  const tampilLayarShalat = !!kunciLayarShalat && layarDitutup !== kunciLayarShalat;

  // Mengaktifkan audio dengan interaksi pengguna
  useEffect(() => {
    if (suaraSiap) return;
    const aktifkan = () => setSuaraSiap(true);
    window.addEventListener("pointerdown", aktifkan, { once: true });
    window.addEventListener("keydown", aktifkan, { once: true });
    return () => {
      window.removeEventListener("pointerdown", aktifkan);
      window.removeEventListener("keydown", aktifkan);
    };
  }, [suaraSiap]);

  // Pengingat shalat
  useEffect(() => {
    if (!dalamPengingat || !reminderSuara || !suaraSiap) return;
    const kunci = ringkasan.berikutnyaKey;
    if (!kunci || nadaTerakhir.current === kunci) return;
    nadaTerakhir.current = kunci;
    bunyikanNada();
  }, [dalamPengingat, reminderSuara, suaraSiap, ringkasan.berikutnyaKey]);

  // Pemutaran Adzan otomatis: waktu Subuh menggunakan audio khusus Subuh (dengan tatswib)
  useEffect(() => {
    if (!adzanAktif || !ringkasan.iqomahKey) return;
    if (adzanTerakhir.current === ringkasan.iqomahKey) return;
    adzanTerakhir.current = ringkasan.iqomahKey;
    // Hanya bunyikan adzan pada menit pertama masuk waktu. Bila layar baru
    // dibuka (atau dimuat ulang) di tengah masa iqomah, adzan tidak diulang.
    const detikSejakMasuk = iqomahMenit * 60 - (ringkasan.iqomahSisa ?? 0);
    if (detikSejakMasuk > 60) return;

    const urlAdzan =
      ringkasan.iqomahKey === "subuh" && adzanSubuhAudioUrl
        ? adzanSubuhAudioUrl
        : adzanAudioUrl || adzanSubuhAudioUrl;

    if (!urlAdzan) return;

    const el = audioAdzan.current;
    if (el) {
      if (el.src !== urlAdzan) {
        el.src = urlAdzan;
      }
      void el.play().catch(() => undefined);
    }
    // iqomahSisa sengaja tidak jadi dependensi: efek cukup berjalan saat masa berganti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adzanAktif, ringkasan.iqomahKey, adzanAudioUrl, adzanSubuhAudioUrl]);

  // Hitung mundur khusus berbuka
  const hitungMundurKe = (jamMenit: string | undefined | null) => {
    if (!waktu || !jamMenit) return null;
    const [jam, menit] = jamMenit.split(":").map(Number);
    if (!Number.isFinite(jam) || !Number.isFinite(menit)) return null;
    let sisa = jam * 3600 + menit * 60 - detikHari(waktu, zona);
    if (sisa < 0) sisa += 86400;
    return sisa;
  };

  const sedangRamadhan = ringkasan.bulan === "Ramadhan";
  const sisaBerbuka = hitungMundurKe(jadwalTampil?.maghrib);

  return (
    <div
      className={`relative flex flex-col bg-paper text-forest-950 ${
        modeTv ? "h-dvh w-screen overflow-hidden" : "min-h-dvh"
      }`}
    >
      {/* Audio adzan selalu terpasang. Sebelumnya hanya ada di luar mode layar
          penuh, sehingga adzan tidak berbunyi di TV yang memakai layar penuh. */}
      {adzanAktif && (adzanAudioUrl || adzanSubuhAudioUrl) && (
        <audio
          ref={audioAdzan}
          src={
            ringkasan.berikutnyaKey === "subuh" && adzanSubuhAudioUrl
              ? adzanSubuhAudioUrl
              : adzanAudioUrl || adzanSubuhAudioUrl
          }
          preload={modeTv ? "auto" : "none"}
          onPlay={() => setAdzanBerbunyi(true)}
          onEnded={() => setAdzanBerbunyi(false)}
          onPause={() => setAdzanBerbunyi(false)}
          onError={() => setAdzanBerbunyi(false)}
        />
      )}

      {tampilLayarShalat && (
        <LayarShalat
          namaMasjid={namaMasjid}
          nama={(ringkasan.iqomahNama ?? shalatBerlangsung?.nama ?? "") as string}
          jamSekarang={ringkasan.jamTampil}
          iqomahSisa={ringkasan.iqomahSisa}
          iqomahTotal={iqomahMenit * 60}
          sedangShalat={!masaAdzanIqomah && sedangShalat}
          onTutup={modeTv ? undefined : () => setLayarDitutup(kunciLayarShalat)}
        />
      )}

      {/* Kepala: identitas di kiri, tanggal di kanan. Navigasi situs hanya di
          mode jendela biasa; di layar penuh TV kepala hanya berisi identitas. */}
      <header className={`relative z-30 flex shrink-0 items-center justify-between gap-6 border-b border-forest-900/10 px-[4vw] ${modeTv ? "py-[2vh]" : "py-3"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <LogoMasjid nama={namaMasjid} logo={logoMasjid} className={`shrink-0 text-forest-800 ${modeTv ? "h-[4.5vh] w-[4.5vh]" : "h-9 w-9"}`} dekoratif />
          <h1 className={`truncate font-display text-forest-950 ${modeTv ? "text-[clamp(1.25rem,2.4vw,2.6rem)]" : "text-xl sm:text-2xl"}`}>{namaMasjid}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {modeTv ? (
            <p className="text-right text-[clamp(0.95rem,1.6vw,1.8rem)] text-ink-500">
              {ringkasan.tanggalPanjang}
              <span className="px-[0.6em] text-forest-900/30">·</span>
              <span className="text-forest-800">{ringkasan.hijriah}</span>
            </p>
          ) : (
            <>
              <nav aria-label="Menu situs" className="hidden items-center gap-5 xl:flex">
                {NAVIGASI.map((tautan) => (
                  <Link key={tautan.href} href={tautan.href} className="text-sm text-ink-500 transition hover:text-forest-800">
                    {tautan.label}
                  </Link>
                ))}
              </nav>
              <div className="hidden items-center gap-2 sm:flex">
                {session ? (
                  <>
                    <Link href={panelHref} className="btn btn-primary min-h-10 py-1.5 text-sm">
                      {role === "jamaah" ? "Dashboard" : "Panel"}
                    </Link>
                    <button type="button" onClick={() => void signOut().catch(() => undefined)} className="btn btn-quiet min-h-10 py-1.5 text-sm">
                      Keluar
                    </button>
                  </>
                ) : (
                  <Link href="/login" className="btn btn-outline min-h-10 py-1.5 text-sm">Masuk</Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMenuTerbuka(!menuTerbuka)}
                className="btn btn-outline min-h-10 px-3 xl:hidden"
                aria-expanded={menuTerbuka}
                aria-label={menuTerbuka ? "Tutup menu" : "Buka menu"}
              >
                Menu
              </button>
            </>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={modeTv ? "flex h-11 w-11 items-center justify-center rounded-lg text-ink-400 transition hover:text-forest-800 focus-visible:text-forest-800" : "btn btn-outline hidden min-h-10 px-3 text-sm sm:inline-flex"}
            aria-label={isFullscreen ? "Keluar layar penuh" : "Mode TV Layar Penuh"}
            title={isFullscreen ? "Keluar layar penuh" : "Mode TV layar penuh"}
          >
            {isFullscreen ? <IkonKeluarLayarPenuh className="h-5 w-5" /> : modeTv ? <IkonLayarPenuh className="h-5 w-5" /> : <><IkonLayarPenuh className="h-4 w-4" /><span className="hidden sm:inline">Layar penuh</span></>}
          </button>
        </div>

        {!modeTv && menuTerbuka && (
          <div className="absolute inset-x-0 top-full z-40 border-b border-forest-900/10 bg-paper px-[4vw] py-4 xl:hidden">
            <nav aria-label="Menu situs" className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {NAVIGASI.map((tautan) => (
                <Link key={tautan.href} href={tautan.href} onClick={() => setMenuTerbuka(false)} className="nav-item">
                  {tautan.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex gap-2 border-t border-forest-900/10 pt-3 sm:hidden">
              {session ? (
                <>
                  <Link href={panelHref} className="btn btn-primary min-h-11">{role === "jamaah" ? "Dashboard" : "Panel"}</Link>
                  <button type="button" onClick={() => void signOut().catch(() => undefined)} className="btn btn-quiet min-h-11">Keluar</button>
                </>
              ) : (
                <Link href="/login" className="btn btn-outline min-h-11">Masuk</Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Isi: konten (ayat/slide) di kiri, jam dan shalat berikutnya di kanan.
          Jam adalah satu-satunya titik fokus; sisanya mengalah. */}
      <main className={`grid min-h-0 flex-1 items-center gap-[4vw] px-[4vw] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] ${modeTv ? "overflow-hidden py-[3vh]" : "py-8"}`}>
        <section aria-label="Tayangan" className={`flex min-h-0 flex-col justify-center ${modeTv ? "h-full overflow-hidden" : ""}`}>
          {slideAktif ? (
            <div key={slideAktif.id} className="animate-fade-in-up mx-auto aspect-video max-h-full w-full overflow-hidden">
              <SlideTayangan slide={slideAktif} kas={konten?.finance ?? null} zona={zona} />
            </div>
          ) : null}
          {/* Panel ayat tetap terpasang (disembunyikan saat slide tampil) agar
              murottal tidak terputus setiap kali slide berganti. */}
          <div className={slideAktif ? "hidden" : "contents"}>
            <AyatShowcase
              ayat={ayat}
              jedaMs={14000}
              tampilkanMurottal={murottalBerbunyi}
              reciter={murottalReciter}
              surah={surahAktif}
              lanjutKeSurahBerikut={surahLanjutOtomatis}
              onSurahBerikutnya={majuSurahBerikutnya}
              tahanMurottal={tahanMurottalAdzan}
              ringkas={modeTv}
            />
          </div>
        </section>

        <section aria-label="Waktu" className="order-first flex flex-col justify-center lg:order-none lg:border-l lg:border-forest-900/10 lg:pl-[4vw]">
          {!modeTv && (
            <p className="text-sm text-ink-500">
              {ringkasan.tanggalPanjang} · <span className="text-forest-800">{ringkasan.hijriah}</span>
            </p>
          )}
          <p className="font-sans font-light leading-none tabular-nums tracking-tight text-forest-950 text-[clamp(4rem,10vw,12rem)]">
            {ringkasan.jamTampil.slice(0, 5)}
            <span className="ml-[0.08em] text-[0.32em] font-normal text-ink-400">{ringkasan.jamTampil.slice(6, 8)}</span>
          </p>

          <div className="mt-[3vh]">
            <p className={`text-[clamp(1rem,1.7vw,2rem)] ${dalamPengingat ? "text-brass-700" : "text-ink-500"}`}>
              {dalamPengingat ? "Bersiap menunaikan shalat" : "Shalat berikutnya"}
            </p>
            <p className="mt-[0.5vh] flex items-baseline gap-[0.4em] text-[clamp(1.75rem,3.6vw,4.2rem)] leading-tight text-forest-950">
              <span className="font-display">{ringkasan.berikutnyaNama}</span>
              <span className="font-light tabular-nums text-forest-800">{ringkasan.berikutnyaJam}</span>
            </p>
            <p className="mt-[0.5vh] text-[clamp(1rem,1.9vw,2.2rem)] tabular-nums text-ink-500">
              {ringkasan.hitungMundur != null ? `${formatDurasi(ringkasan.hitungMundur)} lagi` : "Jadwal hari ini belum tersedia"}
            </p>
          </div>

          {sedangRamadhan && jadwalTampil && (
            <p className="mt-[3vh] text-[clamp(1rem,1.7vw,2rem)] text-ink-500">
              Imsak <span className="tabular-nums text-forest-900">{jadwalTampil.imsak}</span>
              <span className="px-[0.6em] text-forest-900/30">·</span>
              Berbuka <span className="tabular-nums text-forest-900">{jadwalTampil.maghrib}</span>
              {sisaBerbuka != null && <span className="tabular-nums"> ({formatDurasi(sisaBerbuka)} lagi)</span>}
            </p>
          )}

          {/* Status dan kontrol operator: hanya di luar layar penuh, dan hanya
              di layar lebar (TV/laptop). Pengunjung di HP tidak memerlukannya. */}
          {!modeTv && (
            <div className="mt-8 hidden max-w-md lg:block">
              {(tampilkanMurottal || reminderSuara || adzanAktif) && !suaraSiap && (
                <p className="flex items-center gap-1.5 text-xs text-ink-500">
                  <IkonSuara className="h-3.5 w-3.5 text-forest-700" />
                  Ketuk layar sekali agar murottal dan nada pengingat bisa berbunyi.
                </p>
              )}
              <StatusOperator
                status={{ ...statusSinkron, hariJadwalTersimpan: tanggalLokal ? hariTersedia(tanggalLokal) : statusSinkron.hariJadwalTersimpan }}
                zona={zona}
                jadwalTersedia={!!jadwalTampil}
                adzanLokal={adzanAktif ? [adzanAudioUrl, adzanSubuhAudioUrl ?? ""].filter(Boolean).every((u) => u.startsWith("/")) : null}
                murottalAktif={tampilkanMurottal}
              />
              {adzanAktif && (adzanAudioUrl || adzanSubuhAudioUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    const el = audioAdzan.current;
                    if (!el) return;
                    if (el.paused) void el.play().catch(() => undefined);
                    else el.pause();
                  }}
                  className="btn btn-outline mt-3 min-h-10 text-xs"
                >
                  Uji suara adzan
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Jadwal: satu baris teks tanpa kotak. Shalat berikutnya ditandai
          dengan warna dan garis kuningan, satu-satunya aksen di layar. */}
      <section aria-label="Jadwal shalat hari ini" className="shrink-0 border-t border-forest-900/10 px-[4vw]">
        <ol className="grid grid-cols-3 sm:grid-cols-6 lg:flex lg:justify-between">
          {URUTAN_SHALAT.filter((w) => w.key !== "dhuha" && (w.key !== "imsak" || sedangRamadhan)).map((w) => {
            const berikutnya = ringkasan.berikutnyaKey === w.key;
            const wajib = w.key !== "imsak" && w.key !== "terbit";
            return (
              <li key={w.key} className={`relative py-[2vh] ${berikutnya ? "text-forest-950" : wajib ? "text-forest-900" : "text-ink-500"}`}>
                {berikutnya && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] rounded-full bg-brass" />}
                <p className={`text-[clamp(0.85rem,1.4vw,1.6rem)] ${berikutnya ? "font-semibold text-brass-700" : "text-ink-500"}`}>
                  {w.nama}{berikutnya && <span className="sr-only"> (berikutnya)</span>}
                </p>
                <p className={`tabular-nums leading-tight text-[clamp(1.4rem,2.8vw,3.4rem)] ${berikutnya ? "font-semibold" : "font-light"}`}>
                  {jadwalTampil?.[w.key] || "--:--"}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <footer className={`flex shrink-0 items-center justify-between gap-4 border-t border-forest-900/10 px-[4vw] ${modeTv ? "py-[1.4vh]" : "py-3"}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!statusSinkron.online && (
            <span role="status" className="shrink-0 rounded-md bg-brass/25 px-2 py-0.5 text-xs font-semibold text-forest-950">
              Offline, data {statusSinkron.terakhirSinkron ? new Intl.DateTimeFormat("id-ID", { timeZone: zona, hour: "2-digit", minute: "2-digit" }).format(new Date(statusSinkron.terakhirSinkron)) : "tersimpan"}
            </span>
          )}
          {!jadwalTampil && (
            <span role="status" className="shrink-0 rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
              Jadwal hari ini belum tersedia
            </span>
          )}
          <p className="truncate text-[clamp(0.85rem,1.3vw,1.5rem)] text-ink-500">{runningText}</p>
        </div>
        <p className="hidden shrink-0 text-[clamp(0.75rem,1vw,1.1rem)] text-ink-400 sm:block">
          Jadwal {jadwalTampil?.lokasi ?? jadwalAwal?.lokasi ?? "Jakarta"} · {LABEL_ZONA[zona].split(" ")[0]}
        </p>
        {!modeTv && <KreditAplikasi className="hidden lg:inline" />}
      </footer>
    </div>
  );
}
