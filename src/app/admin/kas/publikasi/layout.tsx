import ProteksiAdmin from "@/components/admin/ProteksiAdmin";

// Publikasi ringkasan kas ke jamaah hanya boleh diubah admin (PRD FIN-03).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProteksiAdmin>{children}</ProteksiAdmin>;
}
