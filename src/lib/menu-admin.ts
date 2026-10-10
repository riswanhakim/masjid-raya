/**
 * Menu panel per peran. Halaman dan API tetap menjaga dirinya sendiri; daftar
 * ini hanya menentukan tautan yang ditampilkan agar tiap peran melihat
 * pekerjaannya saja.
 */
export type IdIkon =
  | "dasbor" | "layar" | "jam" | "mikrofon" | "kalender" | "agenda" | "dokumen"
  | "gambar" | "petugas" | "kas" | "pengguna" | "grup" | "akun" | "perisai" | "gir" | "kunci";

export interface ItemMenu {
  href: string;
  label: string;
  ikon: IdIkon;
  roles: string[];
}

const KONTEN = ["admin", "pengurus", "konten"];
const KEUANGAN = ["admin", "bendahara"];
const SEMUA = ["admin", "pengurus", "konten", "bendahara"];

export const MENU_ADMIN: ItemMenu[] = [
  { href: "/admin", label: "Dashboard", ikon: "dasbor", roles: SEMUA },
  { href: "/admin/kas", label: "Buku Kas", ikon: "kas", roles: KEUANGAN },
  { href: "/admin/tayangan", label: "Tayangan TV", ikon: "layar", roles: KONTEN },
  { href: "/admin/khutbah", label: "Khutbah", ikon: "mikrofon", roles: KONTEN },
  { href: "/admin/kegiatan", label: "Kegiatan", ikon: "kalender", roles: KONTEN },
  { href: "/admin/agenda", label: "Agenda", ikon: "agenda", roles: KONTEN },
  { href: "/admin/berita", label: "Berita", ikon: "dokumen", roles: KONTEN },
  { href: "/admin/galeri", label: "Galeri Foto", ikon: "gambar", roles: KONTEN },
  { href: "/admin/petugas", label: "Jadwal Petugas", ikon: "petugas", roles: KONTEN },
  { href: "/admin/jadwal", label: "Jadwal Shalat", ikon: "jam", roles: ["admin"] },
  { href: "/admin/ustadz", label: "Ustadz", ikon: "pengguna", roles: ["admin"] },
  { href: "/admin/pengurus", label: "Pengurus", ikon: "grup", roles: ["admin"] },
  { href: "/admin/pengguna", label: "Pengguna & Telegram", ikon: "akun", roles: ["admin"] },
  { href: "/admin/profil", label: "Profil & Logo", ikon: "perisai", roles: ["admin"] },
  { href: "/admin/pengaturan", label: "Pengaturan", ikon: "gir", roles: ["admin"] },
  { href: "/akun/sandi", label: "Ganti Sandi", ikon: "kunci", roles: SEMUA },
];

export function menuUntuk(role: string | null | undefined) {
  return MENU_ADMIN.filter((item) => !!role && item.roles.includes(role));
}

export function menuAktif(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export const LABEL_PERAN: Record<string, string> = {
  admin: "Admin",
  bendahara: "Bendahara",
  konten: "Pengurus konten",
  pengurus: "Pengurus konten",
  jamaah: "Jamaah",
};
