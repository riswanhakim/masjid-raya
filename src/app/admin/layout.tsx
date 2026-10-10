import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import KreditAplikasi from "@/components/KreditAplikasi";
import { ambilProfil } from "@/lib/profil";
import { getServerAuth } from "@/lib/get-server-auth";
import { PANEL_ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sabuk pengaman lapis kedua: middleware sudah menjaga /admin, tetapi
  // memeriksa ulang di sini memastikan panel tidak pernah dirender tanpa sesi
  // yang sah walau matcher middleware suatu saat berubah.
  const { user, role } = await getServerAuth();
  if (!user || !role || !(PANEL_ROLES as readonly string[]).includes(role)) {
    redirect("/login?callbackUrl=/admin");
  }

  const branding = await ambilProfil();

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-paper text-ink md:flex-row">
      <AdminSidebar namaMasjid={branding.nama} logo={branding.logo} role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</main>
        <footer className="border-t border-forest-900/10 px-4 py-6 sm:px-6 lg:px-10">
          <KreditAplikasi />
        </footer>
      </div>
    </div>
  );
}
