"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KartuAdmin, KepalaAdmin } from "@/components/admin/AdminShell";
import BerkasUnggah from "@/components/admin/BerkasUnggah";
import SlideTayangan, { type RingkasanKasTv } from "@/components/tv/SlideTayangan";
import { IkonSampah, IkonUnggah } from "@/components/Ikon";
import { JENIS_SLIDE, LABEL_JENIS, SINGKATAN_ZONA, isoKeLokal, lokalKeIso, type JenisSlide, type TampilanSlide } from "@/lib/tv";
import { potong16x9 } from "@/lib/gambar-klien";

export interface NilaiTayangan {
  jenis: JenisSlide;
  judul: string;
  isi: string;
  gambar: string | null;
  penceramah: string;
  waktuKegiatan: string;
  lokasi: string;
  tampilan: TampilanSlide;
  mulai: string;
  selesai: string;
  durasi: string;
  urutan: string;
  aktif: boolean;
}

const PETUNJUK_JENIS: Record<JenisSlide, string> = {
  kajian: "Tema, penceramah, waktu, dan tempat kajian. Poster opsional.",
  pengumuman: "Judul dan isi singkat. Gambar opsional.",
  galeri: "Foto kegiatan. Beberapa foto sekaligus menjadi slide terpisah.",
  kas: "Ringkasan kas yang dipublikasikan admin. Angkanya diambil otomatis.",
};

type Galat = { field: string; message: string }[];

/**
 * Formulir tayangan dengan pratinjau langsung di samping. Waktu diisi dalam
 * jam masjid dan dikirim ke server lengkap dengan offset zonanya, sehingga
 * tidak bergantung pada zona waktu laptop pengurus.
 */
export default function FormTayangan({
  id,
  awal,
  zona,
  kas,
}: {
  id?: string;
  awal: NilaiTayangan;
  zona: string;
  kas: RingkasanKasTv | null;
}) {
  const router = useRouter();
  const modeEdit = Boolean(id);
  const [d, setD] = useState<NilaiTayangan>(awal);
  const [fotoGaleri, setFotoGaleri] = useState<string[]>(awal.gambar ? [awal.gambar] : []);
  const [mengunggah, setMengunggah] = useState(false);
  const [galatUnggah, setGalatUnggah] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<{ teks: string; rinci: Galat } | null>(null);
  const masukanFoto = useRef<HTMLInputElement>(null);
  const zonaSingkat = SINGKATAN_ZONA[zona] ?? "";
  const ubah = (p: Partial<NilaiTayangan>) => setD((x) => ({ ...x, ...p }));
  const galatKolom = (f: string) => galat?.rinci.find((g) => g.field === f)?.message;
  const multiFoto = d.jenis === "galeri" && !modeEdit;

  async function unggahBanyak(files: FileList) {
    setGalatUnggah(null);
    setMengunggah(true);
    const hasil: string[] = [];
    for (const berkas of Array.from(files).slice(0, 20)) {
      try {
        const fd = new FormData();
        fd.append("folder", "tayangan");
        fd.append("berkas", await potong16x9(berkas));
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          setGalatUnggah(`${berkas.name}: ${data.error ?? "gagal diunggah"}`);
          continue;
        }
        hasil.push(data.url);
      } catch (e) {
        setGalatUnggah(e instanceof Error && e.message.startsWith("Foto") ? `${berkas.name}: ${e.message}` : "Server tidak dapat dihubungi saat mengunggah.");
      }
    }
    setFotoGaleri((x) => [...x, ...hasil]);
    setMengunggah(false);
    if (masukanFoto.current) masukanFoto.current.value = "";
  }

  function badan(gambar: string | null) {
    return {
      jenis: d.jenis,
      judul: d.judul,
      isi: d.isi || null,
      gambar,
      penceramah: d.jenis === "kajian" ? d.penceramah || null : null,
      waktuKegiatan: d.jenis === "kajian" && d.waktuKegiatan ? lokalKeIso(d.waktuKegiatan, zona) : null,
      lokasi: d.jenis === "kajian" ? d.lokasi || null : null,
      tampilan: d.jenis === "kas" ? "standar" : d.tampilan,
      mulai: d.mulai ? lokalKeIso(d.mulai, zona) : "",
      selesai: d.selesai ? lokalKeIso(d.selesai, zona) : "",
      durasi: Number(d.durasi),
      urutan: Number(d.urutan),
      aktif: d.aktif,
    };
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setGalat(null);
    if (d.tampilan === "foto" && d.jenis !== "kas" && d.jenis !== "galeri" && !d.gambar) {
      setGalat({ teks: "Tampilan foto penuh membutuhkan foto. Unggah foto atau pilih tampilan standar.", rinci: [{ field: "gambar", message: "Foto wajib untuk tampilan foto penuh" }] });
      return;
    }
    if (multiFoto && fotoGaleri.length === 0) {
      setGalat({ teks: "Unggah minimal satu foto untuk galeri.", rinci: [{ field: "gambar", message: "Foto galeri wajib diunggah" }] });
      return;
    }
    setMenyimpan(true);
    try {
      const daftar = multiFoto ? fotoGaleri.map((f) => badan(f)) : [badan(d.jenis === "galeri" ? fotoGaleri[0] ?? null : d.jenis === "kas" ? null : d.gambar)];
      let tersimpan = 0;
      for (const isi of daftar) {
        const res = await fetch(modeEdit ? `/api/admin/tv/${id}` : "/api/admin/tv", {
          method: modeEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isi),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: Galat };
          setGalat({
            teks: tersimpan > 0 ? `${tersimpan} foto sudah tersimpan, sisanya gagal: ${data.error ?? "periksa isian"}.` : data.error ?? "Tayangan gagal disimpan.",
            rinci: data.detail ?? [],
          });
          return;
        }
        tersimpan += 1;
        // Foto yang sudah tersimpan dikeluarkan dari daftar agar "Simpan"
        // berikutnya setelah galat tidak membuat slide ganda.
        if (multiFoto) setFotoGaleri((x) => x.filter((f) => f !== isi.gambar));
      }
      router.push("/admin/tayangan");
      router.refresh();
    } catch {
      setGalat({ teks: "Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi.", rinci: [] });
    } finally {
      setMenyimpan(false);
    }
  }

  const pratinjau = {
    id: "pratinjau",
    jenis: d.jenis,
    judul: d.judul || (d.jenis === "kas" ? "Laporan kas masjid" : "Judul tayangan"),
    isi: d.isi || null,
    gambar: d.jenis === "galeri" ? fotoGaleri[0] ?? null : d.jenis === "kas" ? null : d.gambar,
    penceramah: d.penceramah || null,
    waktuKegiatan: d.waktuKegiatan ? lokalKeIso(d.waktuKegiatan, zona) : null,
    lokasi: d.lokasi || null,
    tampilan: d.jenis === "kas" ? "standar" : d.tampilan,
  };

  const Pesan = ({ f }: { f: string }) => (galatKolom(f) ? <p className="mt-1.5 text-xs text-red-700">{galatKolom(f)}</p> : null);

  return (
    <div>
      <KepalaAdmin
        kicker="Layar TV"
        judul={modeEdit ? "Edit Tayangan" : "Buat Tayangan"}
        keterangan={`Waktu diisi dalam jam masjid (${zonaSingkat}). Pratinjau di samping memakai tampilan yang sama dengan TV.`}
      />

      {galat && (
        <div role="alert" className="mt-6 rounded-lg border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">
          {galat.teks}
          {galat.rinci.length > 0 && <ul className="mt-1 list-disc pl-5">{galat.rinci.map((g) => <li key={g.field + g.message}>{g.message}</li>)}</ul>}
        </div>
      )}

      <form onSubmit={kirim} className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <KartuAdmin className="space-y-6 p-5 sm:p-6">
          <fieldset>
            <legend className="field-label">Jenis tayangan</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {JENIS_SLIDE.map((j) => (
                <label key={j} className={`flex min-h-11 cursor-pointer flex-col rounded-lg border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-700 ${d.jenis === j ? "border-forest-700 bg-forest-50" : "border-forest-900/15 hover:bg-forest-50/60"} ${modeEdit && d.jenis !== j ? "opacity-60" : ""}`}>
                  <input type="radio" name="jenis" value={j} checked={d.jenis === j} disabled={modeEdit} onChange={() => ubah({ jenis: j })} className="sr-only" />
                  <span className="font-medium text-forest-900">{LABEL_JENIS[j]}</span>
                  <span className="text-ink-500">{PETUNJUK_JENIS[j]}</span>
                </label>
              ))}
            </div>
            {modeEdit && <p className="meta mt-2">Jenis tidak bisa diubah setelah dibuat. Buat tayangan baru bila perlu jenis lain.</p>}
          </fieldset>

          {d.jenis !== "kas" && (
            <fieldset>
              <legend className="field-label">Tampilan di TV</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  { v: "standar", judul: "Standar", ket: "Judul dan teks di layar, foto opsional di samping." },
                  { v: "foto", judul: "Foto penuh", ket: "Foto 16:9 memenuhi slide, tanpa teks. Cocok untuk poster jadi." },
                ] as const).map((o) => (
                  <label key={o.v} className={`flex min-h-11 cursor-pointer flex-col rounded-lg border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-700 ${d.tampilan === o.v ? "border-forest-700 bg-forest-50" : "border-forest-900/15 hover:bg-forest-50/60"}`}>
                    <input type="radio" name="tampilan" value={o.v} checked={d.tampilan === o.v} onChange={() => ubah({ tampilan: o.v })} className="sr-only" />
                    <span className="font-medium text-forest-900">{o.judul}</span>
                    <span className="text-ink-500">{o.ket}</span>
                  </label>
                ))}
              </div>
              {d.tampilan === "foto" && (
                <p className="meta mt-2">Judul tetap diisi untuk daftar di panel, tetapi tidak tampil di TV. Isian lain (penceramah, waktu, keterangan) disimpan tanpa ditayangkan.</p>
              )}
            </fieldset>
          )}

          <div>
            <label htmlFor="judul" className="field-label">{d.jenis === "kajian" ? "Tema kajian" : "Judul"}</label>
            <input id="judul" className="field min-h-11" required maxLength={160} value={d.judul} onChange={(e) => ubah({ judul: e.target.value })}
              placeholder={d.jenis === "kas" ? "Contoh: Laporan kas bulan ini" : d.jenis === "kajian" ? "Contoh: Fikih zakat penghasilan" : "Contoh: Kerja bakti Ahad pagi"} />
            <Pesan f="judul" />
          </div>

          {d.jenis === "kajian" && (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="penceramah" className="field-label">Penceramah</label>
                <input id="penceramah" className="field min-h-11" maxLength={120} value={d.penceramah} onChange={(e) => ubah({ penceramah: e.target.value })} />
              </div>
              <div>
                <label htmlFor="waktuKegiatan" className="field-label">Waktu kajian ({zonaSingkat})</label>
                <input id="waktuKegiatan" type="datetime-local" className="field min-h-11" value={d.waktuKegiatan} onChange={(e) => ubah({ waktuKegiatan: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="lokasi" className="field-label">Tempat</label>
                <input id="lokasi" className="field min-h-11" maxLength={160} value={d.lokasi} onChange={(e) => ubah({ lokasi: e.target.value })} placeholder="Contoh: Ruang utama masjid" />
              </div>
            </div>
          )}

          {d.jenis !== "kas" && (
            <div>
              <label htmlFor="isi" className="field-label">{d.jenis === "pengumuman" ? "Isi pengumuman" : "Keterangan (opsional)"}</label>
              <textarea id="isi" className="field" rows={d.jenis === "pengumuman" ? 5 : 3} maxLength={2000} value={d.isi} onChange={(e) => ubah({ isi: e.target.value })} />
              <p className="meta mt-1.5">Teks yang terlalu panjang akan terpotong di TV. Pantau pratinjau.</p>
            </div>
          )}

          {d.jenis === "galeri" ? (
            multiFoto ? (
              <div>
                <span className="field-label">Foto</span>
                <button type="button" disabled={mengunggah} onClick={() => masukanFoto.current?.click()} className="btn btn-outline min-h-11 disabled:opacity-50">
                  <IkonUnggah className="h-4 w-4" />{mengunggah ? "Mengunggah..." : "Pilih foto"}
                </button>
                <input ref={masukanFoto} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files && unggahBanyak(e.target.files)} />
                <p className="meta mt-2">Bisa pilih beberapa foto sekaligus (maksimal 20). Setiap foto dipotong otomatis ke 16:9 (bagian tengah) dan menjadi satu slide dengan judul dan masa tayang yang sama.</p>
                {galatUnggah && <p role="alert" className="mt-2 text-xs text-red-700">{galatUnggah}</p>}
                <Pesan f="gambar" />
                {fotoGaleri.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {fotoGaleri.map((f, i) => (
                      <li key={f} className="flex flex-col items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f} alt={`Foto ${i + 1}`} className="aspect-video h-20 rounded-lg border border-forest-900/10 object-cover" />
                        <button type="button" onClick={() => setFotoGaleri((x) => x.filter((y) => y !== f))} aria-label={`Hapus foto ${i + 1}`} className="inline-flex min-h-11 items-center gap-1 text-xs text-red-700">
                          <IkonSampah className="h-3.5 w-3.5" />Hapus
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <BerkasUnggah folder="tayangan" label="Foto" rasio16x9 value={fotoGaleri[0] ?? null} onChange={(u) => setFotoGaleri(u ? [u] : [])} petunjuk="Foto galeri wajib ada. Dipotong otomatis ke 16:9." />
            )
          ) : d.jenis !== "kas" ? (
            <BerkasUnggah
              folder="tayangan"
              rasio16x9
              label={d.tampilan === "foto" ? "Foto (wajib)" : d.jenis === "kajian" ? "Poster (opsional)" : "Gambar (opsional)"}
              value={d.gambar}
              onChange={(u) => ubah({ gambar: u })}
              petunjuk="Foto dipotong otomatis ke 16:9 (bagian tengah), paling besar 1920×1080. Siapkan desain 16:9 agar tidak ada bagian yang terpotong."
            />
          ) : null}

          <fieldset className="grid gap-6 border-t border-forest-900/10 pt-6 sm:grid-cols-2">
            <legend className="sr-only">Masa tayang</legend>
            <div>
              <label htmlFor="mulai" className="field-label">Mulai tayang ({zonaSingkat})</label>
              <input id="mulai" type="datetime-local" required className="field min-h-11" value={d.mulai} onChange={(e) => ubah({ mulai: e.target.value })} />
            </div>
            <div>
              <label htmlFor="selesai" className="field-label">Akhir tayang ({zonaSingkat})</label>
              <input id="selesai" type="datetime-local" required className="field min-h-11" value={d.selesai} onChange={(e) => ubah({ selesai: e.target.value })} />
              <Pesan f="selesai" />
              {d.jenis === "kajian" && d.waktuKegiatan && (
                <button type="button" className="mt-1 inline-flex min-h-11 items-center text-sm text-forest-700" onClick={() => ubah({ selesai: isoKeLokal(new Date(new Date(lokalKeIso(d.waktuKegiatan, zona)).getTime() + 2 * 3600000), zona) })}>
                  Sampai 2 jam setelah kajian dimulai
                </button>
              )}
            </div>
            <div>
              <label htmlFor="durasi" className="field-label">Durasi tampil (detik)</label>
              <input id="durasi" type="number" min={5} max={120} required className="field min-h-11" value={d.durasi} onChange={(e) => ubah({ durasi: e.target.value })} />
              <p className="meta mt-1.5">5 sampai 120 detik. Bawaan 15.</p>
            </div>
            <div>
              <label htmlFor="urutan" className="field-label">Urutan</label>
              <input id="urutan" type="number" min={0} max={9999} required className="field min-h-11" value={d.urutan} onChange={(e) => ubah({ urutan: e.target.value })} />
              <p className="meta mt-1.5">Angka kecil tampil lebih dulu.</p>
            </div>
            <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-forest-700" checked={d.aktif} onChange={(e) => ubah({ aktif: e.target.checked })} />
              <span className="text-sm text-forest-900">Aktif (matikan untuk menyimpan sebagai draf tanpa menayangkan)</span>
            </label>
          </fieldset>

          <div className="flex flex-wrap gap-3 border-t border-forest-900/10 pt-6">
            <button type="submit" disabled={menyimpan || mengunggah} className="btn btn-primary min-h-11 disabled:opacity-50">
              {menyimpan ? "Menyimpan..." : modeEdit ? "Simpan perubahan" : multiFoto && fotoGaleri.length > 1 ? `Simpan ${fotoGaleri.length} slide` : "Simpan tayangan"}
            </button>
            <button type="button" onClick={() => router.push("/admin/tayangan")} className="btn btn-outline min-h-11">Batal</button>
          </div>
        </KartuAdmin>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <p className="field-label">Pratinjau di TV</p>
          <div className="rounded-xl bg-paper-200 p-3">
            <div className="aspect-video overflow-hidden">
              <SlideTayangan slide={pratinjau} kas={kas} zona={zona} />
            </div>
          </div>
          {multiFoto && fotoGaleri.length > 1 && <p className="meta mt-2">Menampilkan foto pertama dari {fotoGaleri.length}.</p>}
        </div>
      </form>
    </div>
  );
}
