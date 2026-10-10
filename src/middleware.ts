import { withAuth } from "next-auth/middleware";
import { PANEL_ROLES, canFinance, canContent } from "./lib/permissions";

// Konfigurasi sistem dan akun: hanya admin (tabel hak akses PRD bagian 4).
const HALAMAN_ADMIN = ["/admin/jadwal", "/admin/ustadz", "/admin/pengurus", "/admin/pengguna", "/admin/profil", "/admin/pengaturan"];

export default withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token, req }) => {
      // Token yatim (akun dihapus / sesi dimatikan di jwt callback) tidak
      // punya sub — tolak walau objek token masih truthy.
      if (!token || !token.sub) return false;

      const path = req.nextUrl.pathname;
      const role = token.role as string | undefined;

      if (path.startsWith("/admin")) {
        if (path.startsWith("/admin/kas/publikasi")) return role === "admin";
        if (path.startsWith("/admin/kas")) return canFinance(role);
        if (path === "/admin") return !!role && (PANEL_ROLES as readonly string[]).includes(role);
        if (HALAMAN_ADMIN.some((awal) => path === awal || path.startsWith(`${awal}/`))) return role === "admin";
        return canContent(role);
      }

      if (path.startsWith("/jamaah")) {
        return role === "jamaah" || role === "admin" || role === "pengurus";
      }

      if (path.startsWith("/akun")) {
        return !!role && ([...PANEL_ROLES, "jamaah"] as string[]).includes(role);
      }

      return true;
    },
  },
});

// Hanya laman yang butuh login. Route /api/admin/* tidak masuk matcher ini
// karena masing-masing sudah menjaga dirinya lewat withAdminAuth.
export const config = {
  matcher: ["/admin/:path*", "/jamaah/:path*", "/akun/:path*"],
};
