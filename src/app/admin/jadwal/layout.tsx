import ProteksiAdmin from "@/components/admin/ProteksiAdmin";

// Jadwal shalat termasuk konfigurasi sistem: hanya admin.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProteksiAdmin>{children}</ProteksiAdmin>;
}
