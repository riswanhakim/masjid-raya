import type { Prisma } from "@prisma/client";
import prisma from "./prisma";

export interface FinanceInput {
  tanggal: Date;
  jenis: string;
  kategori?: string | null;
  keterangan: string;
  jumlah: number;
  dana?: string;
  bukti?: string | null;
}

export async function createTransaction(tx: Prisma.TransactionClient, input: FinanceInput, actorId: string, sumber = "panel") {
  const row = await tx.kasTransaksi.create({ data: { ...input, pencatatId: actorId, sumber } });
  await tx.auditLog.create({ data: { actorId, entity: "kas", entityId: row.id, action: "create", after: JSON.stringify(row) } });
  return row;
}

/**
 * Koreksi (input berisi kolom) atau batalkan (input null) satu transaksi.
 * Keduanya wajib beralasan dan menyimpan nilai sebelum/sesudah di audit;
 * pembatalan hanya menandai deletedAt sehingga riwayatnya tetap ada.
 */
export async function changeTransaction(id: string, input: Partial<FinanceInput> | null, actorId: string, alasan: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.kasTransaksi.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw Object.assign(new Error("TRANSACTION_NOT_FOUND"), { code: "P2025" });
    const after = await tx.kasTransaksi.update({ where: { id }, data: input ?? { deletedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId, entity: "kas", entityId: id, action: input ? "update" : "void", before: JSON.stringify(before), after: JSON.stringify(after), alasan } });
    return after;
  });
}

export function summarize(rows: { jenis: string; jumlah: number; dana: string }[]) {
  const dana: Record<string, { masuk: number; keluar: number; saldo: number }> = {};
  let masuk = 0;
  let keluar = 0;
  for (const row of rows) {
    if (row.jenis === "masuk") masuk += row.jumlah;
    else keluar += row.jumlah;
    const fund = dana[row.dana] ?? { masuk: 0, keluar: 0, saldo: 0 };
    if (row.jenis === "masuk") fund.masuk += row.jumlah;
    else fund.keluar += row.jumlah;
    fund.saldo = fund.masuk - fund.keluar;
    dana[row.dana] = fund;
  }
  return { masuk, keluar, saldo: masuk - keluar, dana };
}
