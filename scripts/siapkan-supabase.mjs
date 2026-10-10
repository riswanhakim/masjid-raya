// Siapkan Supabase Storage: bucket "publik" (media yang boleh dilihat siapa
// saja, dilayani CDN) dan "privat" (bukti transaksi, hanya lewat tautan
// bertanda tangan dari server). Aman dijalankan berulang kali.
let url = "";
try {
  url = new URL(process.env.SUPABASE_URL ?? "").origin;
} catch {
  url = "";
}
const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !kunci) throw new Error("Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env terlebih dulu.");

const header = { Authorization: `Bearer ${kunci}`, apikey: kunci, "Content-Type": "application/json" };
for (const [id, publik] of [["publik", true], ["privat", false]]) {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: header,
    body: JSON.stringify({ id, name: id, public: publik, file_size_limit: 4 * 1024 * 1024 }),
  });
  const teks = await res.text();
  if (res.ok) console.log(`Bucket "${id}" dibuat (${publik ? "publik" : "privat"}).`);
  else if (/already exists|Duplicate/i.test(teks)) {
    const ubah = await fetch(`${url}/storage/v1/bucket/${id}`, { method: "PUT", headers: header, body: JSON.stringify({ public: publik, file_size_limit: 4 * 1024 * 1024 }) });
    console.log(ubah.ok ? `Bucket "${id}" sudah ada; pengaturannya diselaraskan.` : `Bucket "${id}" sudah ada, tetapi gagal diselaraskan (${ubah.status}).`);
  } else throw new Error(`Gagal membuat bucket "${id}": ${res.status} ${teks.slice(0, 200)}`);
}
