import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/get-server-auth";
import { canContent } from "@/lib/permissions";

// Penjagaan server untuk halaman konten (middleware memakai peran dari token
// yang bisa tertinggal setelah admin mengubah peran).
export default async function LayoutKonten({ children }: { children: React.ReactNode }) {
  const { role } = await getServerAuth();
  if (!canContent(role)) redirect("/admin");
  return children;
}
