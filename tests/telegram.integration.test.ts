import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { processTelegram } from "../src/lib/telegram";
import { changeTransaction } from "../src/lib/finance";

test("Telegram confirms once, rejects other roles, and retains finance audit", async () => {
  const unique = `${Date.now()}`;
  const telegramId = 800000000 + Math.floor(Math.random() * 100000000);
  const user = await prisma.user.create({ data: { email: `test-${unique}@example.invalid`, role: "bendahara", telegramId: String(telegramId) } });
  let updateId = 1000000000 + Math.floor(Math.random() * 100000000);
  const ids: number[] = [];
  const send = async (text: string, id = ++updateId) => {
    ids.push(id);
    return processTelegram({ update_id: id, message: { from: { id: telegramId }, chat: { id: telegramId, type: "private" }, text } });
  };
  try {
    const ringkas = await send("-350rb listrik 25/09/2026");
    assert.match(ringkas!.text, /Pengeluaran Rp350\.000/);
    assert.equal(await prisma.kasTransaksi.count({ where: { pencatatId: user.id } }), 0);
    const confirmId = ++updateId;
    await send("Simpan", confirmId);
    await send("Simpan", confirmId);
    const rows = await prisma.kasTransaksi.findMany({ where: { pencatatId: user.id } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].jumlah, 350000);
    assert.equal(rows[0].sumber, "telegram");
    assert.equal(rows[0].dana, "Operasional");
    assert.equal(rows[0].tanggal.toISOString(), "2026-09-25T00:00:00.000Z");
    await changeTransaction(rows[0].id, { jumlah: 300000 }, user.id, "Salah ketik nominal");
    await changeTransaction(rows[0].id, null, user.id, "Transaksi ganda");
    assert.equal(await prisma.kasTransaksi.count({ where: { pencatatId: user.id, deletedAt: null } }), 0);
    const audits = await prisma.auditLog.findMany({ where: { actorId: user.id }, orderBy: { createdAt: "asc" } });
    assert.equal(audits.length, 3);
    assert.equal(JSON.parse(audits[1].before!).jumlah, 350000);
    await prisma.user.update({ where: { id: user.id }, data: { role: "konten" } });
    const denied = await send("Pengeluaran");
    assert.match(denied!.text, /tidak memiliki akses/);
    const group = await processTelegram({ update_id: ++updateId, message: { from: { id: telegramId }, chat: { id: -123, type: "group" }, text: "Saldo" } });
    assert.equal(group, null);
  } finally {
    await prisma.telegramUpdate.deleteMany({ where: { id: { in: ids.map((x) => BigInt(x)) } } });
    await prisma.telegramConversation.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
    await prisma.kasTransaksi.deleteMany({ where: { pencatatId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
