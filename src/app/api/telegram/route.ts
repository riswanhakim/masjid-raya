import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processTelegram, telegramCall, updateSchema } from "@/lib/telegram";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const supplied = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || !process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "Bot belum dikonfigurasi" }, { status: 503 });
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.text();
  if (body.length > 100000) return NextResponse.json({ error: "Payload terlalu besar" }, { status: 413 });
  try {
    const parsed = updateSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return NextResponse.json({ error: "Update tidak valid" }, { status: 400 });
    const reply = await processTelegram(parsed.data);
    if (reply) {
      await telegramCall("sendMessage", reply);
      await prisma.telegramUpdate.updateMany({ where: { id: parsed.data.update_id }, data: { sent: true } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Update belum berhasil diproses" }, { status: 500 });
  }
}
