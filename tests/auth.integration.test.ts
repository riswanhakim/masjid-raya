import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { authOptions } from "../src/lib/auth";

test("password session version revokes old JWT and role changes are read immediately", async () => {
  const user = await prisma.user.create({ data: { email: `auth-${Date.now()}@example.invalid`, role: "admin", password: "test-hash" } });
  const jwt = authOptions.callbacks!.jwt!;
  try {
    // NextAuth omits user when checking an existing JWT.
    const args = { token: { sub: user.id, sessionVersion: 0, role: "admin" }, account: null } as unknown as Parameters<typeof jwt>[0];
    assert.equal((await jwt(args)).sub, user.id);
    await prisma.user.update({ where: { id: user.id }, data: { role: "konten" } });
    assert.equal((await jwt(args)).role, "konten");
    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    assert.equal((await jwt(args)).sub, undefined);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
