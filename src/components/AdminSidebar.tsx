"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoMasjid from "@/components/LogoMasjid";
import {
  IkonAgenda,
  IkonAkun,
  IkonDasbor,
  IkonDokumen,
  IkonGambar,
  IkonGir,
  IkonGrup,
  IkonJam,
  IkonKalender,
  IkonKas,
  IkonKunci,
  IkonLayar,
  IkonMenu,
  IkonMikrofon,
  IkonPengguna,
  IkonPerisai,
  IkonPetugas,
  IkonTutup,
} from "@/components/Ikon";
import { LABEL_PERAN, menuAktif, menuUntuk, type IdIkon } from "@/lib/menu-admin";

const IKON: Record<IdIkon, (p: { className?: string }) => React.JSX.Element> = {
  dasbor: IkonDasbor,
  layar: IkonLayar,
  jam: IkonJam,
  mikrofon: IkonMikrofon,
  kalender: IkonKalender,
  agenda: IkonAgenda,
  dokumen: IkonDokumen,
  gambar: IkonGambar,
  petugas: IkonPetugas,
  kas: IkonKas,
  pengguna: IkonPengguna,
  grup: IkonGrup,
  akun: IkonAkun,
  perisai: IkonPerisai,
  gir: IkonGir,
  kunci: IkonKunci,
};

function DaftarMenu({ role, onPilih }: { role: string; onPilih?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {menuUntuk(role).map((item) => {
        const Ikon = IKON[item.ikon];
        const aktif = menuAktif(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onPilih}
            aria-current={aktif ? "page" : undefined}
            className={`nav-item ${aktif ? "nav-item-aktif" : ""}`}
          >
            <Ikon className="h-4 w-4 shrink-0" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

/**
 * Navigasi panel. Desktop: sidebar tetap. Di bawah 768px: bilah atas ringkas
 * dengan tombol "Menu" yang membuka daftar penuh, karena sidebar tidak muat
 * dan pengurus banyak mencatat dari HP.
 */
export default function AdminSidebar({
  namaMasjid,
  logo,
  role,
}: {
  namaMasjid: string;
  logo?: string | null;
  role: string;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const pathname = usePathname();
  const tombol = useRef<HTMLButtonElement>(null);

  useEffect(() => setTerbuka(false), [pathname]);
  useEffect(() => {
    if (!terbuka) return;
    const tutup = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTerbuka(false);
        tombol.current?.focus();
      }
    };
    window.addEventListener("keydown", tutup);
    return () => window.removeEventListener("keydown", tutup);
  }, [terbuka]);

  const identitas = (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
      <LogoMasjid nama={namaMasjid} logo={logo} className="h-7 w-7 shrink-0 text-forest-700" dekoratif />
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold tracking-tight text-forest-900">{namaMasjid}</span>
        <span className="block text-xs text-ink-500">Panel {LABEL_PERAN[role] ?? "Pengelola"}</span>
      </span>
    </Link>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-forest-900/10 bg-forest-50/50 md:block">
        <div className="sticky top-0 flex h-dvh flex-col p-5">
          {identitas}
          <nav aria-label="Menu panel" className="mt-8 space-y-1 overflow-y-auto">
            <DaftarMenu role={role} />
          </nav>
          <div className="mt-auto border-t border-forest-900/10 pt-5">
            <Link href="/" className="nav-item">
              <IkonLayar className="h-4 w-4 shrink-0" />
              <span>Buka layar TV</span>
            </Link>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-40 border-b border-forest-900/10 bg-paper/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          {identitas}
          <button
            ref={tombol}
            type="button"
            onClick={() => setTerbuka((v) => !v)}
            aria-expanded={terbuka}
            aria-controls="menu-panel-hp"
            className="btn btn-outline min-h-11 shrink-0"
          >
            {terbuka ? <IkonTutup className="h-4 w-4" /> : <IkonMenu className="h-4 w-4" />}
            {terbuka ? "Tutup" : "Menu"}
          </button>
        </div>
        {terbuka && (
          <nav id="menu-panel-hp" aria-label="Menu panel" className="max-h-[calc(100dvh-4rem)] space-y-1 overflow-y-auto border-t border-forest-900/10 px-4 pb-6 pt-3">
            <DaftarMenu role={role} onPilih={() => setTerbuka(false)} />
            <div className="mt-3 border-t border-forest-900/10 pt-3">
              <Link href="/" className="nav-item">
                <IkonLayar className="h-4 w-4 shrink-0" />
                <span>Buka layar TV</span>
              </Link>
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
