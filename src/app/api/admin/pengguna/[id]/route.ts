import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withAdminAuth, type KonteksRute } from "@/lib/api-auth";
import { bacaTubuh, galatDatabase, tidakDitemukan } from "@/lib/api-util";
import { penggunaUbahSchema } from "@/lib/validasi";
import { getServerAuth } from "@/lib/get-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PILIH_AMAN = {
  id: true,
  name: true,
  email: true,
  role: true,
  telegramId: true,
  createdAt: true,
} as const;

async function getHandler(_req: NextRequest, { params }: KonteksRute<{ id: string }>) {
  const { id } = await params;
  const pengguna = await prisma.user.findUnique({
    where: { id },
    select: PILIH_AMAN,
  });
  if (!pengguna) return tidakDitemukan();
  return NextResponse.json(pengguna, { headers: { "Cache-Control": "no-store" } });
}

async function putHandler(req: NextRequest, { params }: KonteksRute<{ id: string }>) {
  const { id } = await params;
  const dibaca = await bacaTubuh(req, penggunaUbahSchema);
  if (!dibaca.ok) return dibaca.respons;

  const d = dibaca.data;

  const data: Prisma.UserUpdateInput = {};
  if (d.nama !== undefined) data.name = d.nama;
  if (d.email !== undefined) data.email = d.email;
  if (d.role !== undefined) data.role = d.role;
  // Sandi hanya di-hash bila memang dikirim non-kosong (lihat sandiOpsional).
  if (d.sandi !== undefined) {
    data.password = await bcrypt.hash(d.sandi, 12);
    data.sessionVersion = { increment: 1 };
  }
  if (d.telegramId !== undefined) data.telegramId = d.telegramId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Tidak ada kolom yang dikirim untuk diperbarui" },
      { status: 400 }
    );
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!target) return tidakDitemukan();

    // Jangan sampai admin terakhir diturunkan perannya sehingga panel terkunci
    // total tanpa jalan masuk kembali.
    const menurunkanAdmin =
      target.role === "admin" && d.role !== undefined && d.role !== "admin";
    if (menurunkanAdmin) {
      const jumlahAdmin = await prisma.user.count({ where: { role: "admin" } });
      if (jumlahAdmin <= 1) {
        return NextResponse.json(
          {
            error:
              "Tidak bisa menurunkan peran admin terakhir. Tambahkan admin lain lebih dulu.",
          },
          { status: 400 }
        );
      }
    }

    const sebelum = await prisma.user.findUnique({ where: { id }, select: { role: true, telegramId: true } });
    const pengguna = await prisma.user.update({
      where: { id },
      data,
      select: PILIH_AMAN,
    });
    // Perubahan peran dan tautan Telegram menentukan akses keuangan/konten,
    // jadi dicatat (tanpa sandi atau hash).
    if (sebelum && (sebelum.role !== pengguna.role || sebelum.telegramId !== pengguna.telegramId || d.sandi)) {
      const { user: pelaku } = await getServerAuth();
      await prisma.auditLog.create({
        data: {
          actorId: pelaku?.id ?? "tidak-diketahui",
          entity: "pengguna",
          entityId: id,
          action: "update",
          before: JSON.stringify(sebelum),
          after: JSON.stringify({ role: pengguna.role, telegramId: pengguna.telegramId, sandiDireset: Boolean(d.sandi) }),
        },
      });
    }
    return NextResponse.json(pengguna);
  } catch (error) {
    const meta = (error as { code?: string; meta?: { target?: unknown } }).meta;
    if ((error as { code?: string }).code === "P2002" && String(meta?.target ?? "").includes("telegramId")) {
      return NextResponse.json({ error: "ID Telegram ini sudah ditautkan ke akun lain. Cabut dulu dari akun tersebut." }, { status: 409 });
    }
    return galatDatabase(error, "Gagal memperbarui pengguna");
  }
}

async function deleteHandler(_req: NextRequest, { params }: KonteksRute<{ id: string }>) {
  const { id } = await params;
  const { user } = await getServerAuth();

  // Menghapus akun sendiri akan mengakhiri sesi di tengah jalan; cegah.
  if (user?.id === id) {
    return NextResponse.json(
      { error: "Tidak bisa menghapus akun yang sedang Anda pakai." },
      { status: 400 }
    );
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!target) return tidakDitemukan();

    if (target.role === "admin") {
      const jumlahAdmin = await prisma.user.count({ where: { role: "admin" } });
      if (jumlahAdmin <= 1) {
        return NextResponse.json(
          { error: "Tidak bisa menghapus admin terakhir." },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return galatDatabase(error, "Gagal menghapus pengguna");
  }
}

export const GET = withAdminAuth(getHandler, ["admin"]);
export const PUT = withAdminAuth(putHandler, ["admin"]);
export const DELETE = withAdminAuth(deleteHandler, ["admin"]);
