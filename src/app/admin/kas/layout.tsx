import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/get-server-auth";
import { canFinance } from "@/lib/permissions";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const { role } = await getServerAuth();
  if (!canFinance(role)) redirect("/admin");
  return children;
}
