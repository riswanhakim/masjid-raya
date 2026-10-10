// Jalankan tes. Tes unit selalu jalan; tes integrasi (berakhiran
// .integration.test.ts) butuh PostgreSQL di TEST_DATABASE_URL, misalnya
// proyek Supabase dev dengan ?schema=uji agar tidak bercampur data preview.
import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";

const semua = readdirSync("tests").filter((f) => f.endsWith(".test.ts")).map((f) => `tests/${f}`);
const integrasi = semua.filter((f) => f.endsWith(".integration.test.ts"));
const db = process.env.TEST_DATABASE_URL;
const pilih = db ? semua : semua.filter((f) => !integrasi.includes(f));
const env = { ...process.env, NEXTAUTH_SECRET: "uji" };
if (db) {
  Object.assign(env, { DATABASE_URL: db, DIRECT_URL: process.env.TEST_DIRECT_URL || db });
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
} else {
  console.log(`TEST_DATABASE_URL kosong: ${integrasi.length} berkas tes integrasi dilewati.`);
}
execSync(`node --import tsx --test ${pilih.join(" ")}`, { stdio: "inherit", env });
