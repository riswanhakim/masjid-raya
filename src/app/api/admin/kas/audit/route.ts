import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/api-auth";

export const GET = withAdminAuth(async () => NextResponse.json(await prisma.auditLog.findMany({ where: { entity: "kas" }, orderBy: { createdAt: "desc" }, take: 200 }), { headers: { "Cache-Control": "no-store" } }), ["admin", "bendahara"]);
