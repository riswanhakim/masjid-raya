"use client";

import { useEffect, useState } from "react";
import {
  AksiForm,
  KolomTeks,
  PesanFormBox,
  useSimpanForm,
} from "@/components/admin/FormAdmin";
import { KartuAdmin, KepalaAdmin } from "@/components/admin/AdminShell";

type Peran = "admin" | "bendahara" | "konten" | "pengurus" | "jamaah";

interface DataPengguna {
  nama: string;
  email: string;
  role: Peran;
  sandi: string;
  telegramId: string;
}

const AWAL: DataPengguna = { nama: "", email: "", role: "konten", sandi: "", telegramId: "" };

const PILIHAN_PERAN: { nilai: Peran; label: string; keterangan: string }[] = [
  { nilai: "admin", label: "Admin", keterangan: "Akses penuh: akun, pengaturan, keuangan, dan konten." },
  { nilai: "bendahara", label: "Bendahara", keterangan: "Buku kas, bukti, laporan, dan ekspor. Tidak mengelola konten TV." },
  { nilai: "konten", label: "Pengurus konten", keterangan: "Tayangan TV, kajian, kegiatan, berita, dan galeri. Tidak melihat keuangan." },
  { nilai: "jamaah", label: "Jamaah", keterangan: "Hanya dasbor jamaah, tanpa akses pengelolaan." },
];

export default function FormPengguna({ id }: { id?: string }) {
  const modeEdit = Boolean(id);
  const { menyimpan, pesan, simpan, router } = useSimpanForm();
  const [data, setData] = useState<DataPengguna>(AWAL);
  const [memuat, setMemuat] = useState(modeEdit);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pengguna/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const hasil = (await res.json()) as {
          name: string | null;
          email: string;
          role: string;
          telegramId: string | null;
        };
        setData({
          nama: hasil.name ?? "",
          email: hasil.email,
          // Peran lama "pengurus" setara pengurus konten.
          role: hasil.role === "pengurus" ? "konten" : ((hasil.role as Peran) ?? "jamaah"),
          sandi: "",
          telegramId: hasil.telegramId ?? "",
        });
      } catch {
        // Biarkan formulir kosong bila pengambilan gagal; pesan muncul saat simpan.
      } finally {
        setMemuat(false);
      }
    })();
  }, [id]);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    await simpan({
      url: modeEdit ? `/api/admin/pengguna/${id}` : "/api/admin/pengguna",
      method: modeEdit ? "PUT" : "POST",
      body: modeEdit ? data : { nama: data.nama, email: data.email, role: data.role, sandi: data.sandi },
      suksesUrl: "/admin/pengguna",
      pesanSukses: modeEdit ? "Akun diperbarui." : "Akun baru dibuat.",
    });
  }

  if (memuat) {
    return <p className="text-sm text-ink-400">Memuat data pengguna...</p>;
  }

  return (
    <div className="max-w-3xl">
      <KepalaAdmin
        kicker="Administrasi"
        judul={modeEdit ? "Edit Pengguna" : "Tambah Pengguna"}
        keterangan={
          modeEdit
            ? "Kosongkan kolom sandi bila tidak ingin menggantinya."
            : "Buat akun untuk pengurus atau jamaah. Sandi minimal 8 karakter."
        }
      />

      <PesanFormBox pesan={pesan} />

      <form onSubmit={kirim} className="mt-8">
        <KartuAdmin className="space-y-6 p-6 lg:p-8">
          <KolomTeks
            id="nama"
            label="Nama lengkap"
            nilai={data.nama}
            onUbah={(v) => setData({ ...data, nama: v })}
            placeholder="H. Muhammad Yusuf"
            wajib
            maks={120}
          />

          <KolomTeks
            id="email"
            type="email"
            label="Surel (untuk masuk)"
            nilai={data.email}
            onUbah={(v) => setData({ ...data, email: v })}
            placeholder="nama@email.com"
            wajib
            maks={160}
          />

          <fieldset>
            <legend className="field-label">Peran</legend>
            <div className="space-y-2">
              {PILIHAN_PERAN.map((p) => (
                <label key={p.nilai} className="flex min-h-11 items-start gap-3 rounded-lg border border-forest-900/10 p-3">
                  <input type="radio" name="role" className="mt-1 accent-forest-700" value={p.nilai} checked={data.role === p.nilai} onChange={() => setData({ ...data, role: p.nilai })} />
                  <span className="text-sm"><span className="font-medium text-forest-900">{p.label}</span><span className="block text-ink-500">{p.keterangan}</span></span>
                </label>
              ))}
            </div>
            <p className="meta mt-2">Perubahan peran berlaku pada aksi berikutnya, termasuk di bot Telegram.</p>
          </fieldset>

          {modeEdit && (
            <div>
              <label htmlFor="telegramId" className="field-label">ID Telegram</label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="telegramId"
                  inputMode="numeric"
                  className="field min-h-11 max-w-xs tabular-nums"
                  value={data.telegramId}
                  onChange={(e) => setData({ ...data, telegramId: e.target.value.replace(/\D/g, "") })}
                  placeholder="Contoh: 123456789"
                  maxLength={20}
                  aria-describedby="petunjuk-telegram"
                />
                {data.telegramId && (
                  <button type="button" className="btn btn-outline min-h-11 text-red-700" onClick={() => setData({ ...data, telegramId: "" })}>
                    Cabut tautan
                  </button>
                )}
              </div>
              <p id="petunjuk-telegram" className="meta mt-1.5">
                Minta pengurus mengirim pesan apa saja ke bot. Bot membalas dengan ID angka miliknya; salin ke sini lalu simpan. Username Telegram tidak dipakai untuk izin.
              </p>
            </div>
          )}

          <KolomTeks
            id="sandi"
            type="password"
            label={modeEdit ? "Sandi baru (opsional)" : "Sandi"}
            nilai={data.sandi}
            onUbah={(v) => setData({ ...data, sandi: v })}
            placeholder={
              modeEdit ? "Biarkan kosong bila tidak diganti" : "Minimal 8 karakter"
            }
            wajib={!modeEdit}
            maks={200}
            petunjuk={
              modeEdit ? "Isi hanya bila ingin mereset sandi akun ini." : undefined
            }
          />

          <AksiForm
            menyimpan={menyimpan}
            labelSimpan={modeEdit ? "Simpan perubahan" : "Buat akun"}
            onBatal={() => router.push("/admin/pengguna")}
          />
        </KartuAdmin>
      </form>
    </div>
  );
}
