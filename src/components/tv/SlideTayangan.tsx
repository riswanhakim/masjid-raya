import { LABEL_JENIS, labelWaktuLokal, type JenisSlide } from "@/lib/tv";

export interface DataSlide {
  id: string;
  jenis: string;
  judul: string;
  isi: string | null;
  gambar: string | null;
  penceramah?: string | null;
  waktuKegiatan?: string | Date | null;
  lokasi?: string | null;
  /** "foto": foto 16:9 memenuhi slide tanpa teks. */
  tampilan?: string | null;
}

export interface RingkasanKasTv {
  periode: string;
  dari: string | null;
  saldoAwal: number;
  masuk: number;
  keluar: number;
  saldoAkhir: number;
  dana: { nama: string; saldo: number }[];
}

const rp = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(n)}`;

/**
 * Satu slide tayangan. Dipakai layar TV dan pratinjau panel sehingga yang
 * dilihat pengurus sama dengan yang tampil di masjid. Ukuran huruf memakai
 * satuan kontainer (cqw), jadi proporsinya tetap sama di TV 1920 px maupun
 * kotak pratinjau 400 px.
 */
export default function SlideTayangan({
  slide,
  kas,
  zona,
}: {
  slide: DataSlide;
  kas?: RingkasanKasTv | null;
  zona: string;
}) {
  const jenis = (slide.jenis in LABEL_JENIS ? slide.jenis : "pengumuman") as JenisSlide;

  // Foto penuh: hanya foto. Foto sudah dipotong 16:9 saat diunggah; contain
  // tetap dipakai agar foto lama yang belum 16:9 tidak terdistorsi.
  if (slide.tampilan === "foto" && slide.gambar && jenis !== "kas") {
    return (
      <div className="h-full w-full overflow-hidden rounded-[1.5%] bg-forest-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.gambar} alt={slide.judul} className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div className="@container h-full w-full">
      <article className="flex h-full w-full flex-col overflow-hidden rounded-[2cqw] border border-forest-900/10 bg-white/80 p-[4cqw] text-forest-950">
        <p className="text-[2.1cqw] font-bold uppercase tracking-[0.18em] text-brass-700">{LABEL_JENIS[jenis]}</p>

        {jenis === "kas" ? (
          <IsiKas judul={slide.judul} kas={kas ?? null} />
        ) : jenis === "galeri" ? (
          <div className="mt-[2cqw] flex min-h-0 flex-1 flex-col">
            {slide.gambar && (
              // Foto tidak dipotong (object-contain) agar tidak terdistorsi.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.gambar} alt={slide.judul} className="min-h-0 w-full flex-1 rounded-[1.2cqw] bg-forest-50 object-contain" />
            )}
            <h2 className="mt-[2cqw] line-clamp-2 font-display text-[4.2cqw] leading-tight">{slide.judul}</h2>
            {slide.isi && <p className="mt-[0.8cqw] line-clamp-2 text-[2.4cqw] text-ink-500">{slide.isi}</p>}
          </div>
        ) : (
          <div className={`mt-[2cqw] grid min-h-0 flex-1 gap-[3cqw] ${slide.gambar ? "grid-cols-[1.15fr_1fr]" : "grid-cols-1"}`}>
            <div className="flex min-h-0 flex-col">
              <h2 className="line-clamp-3 font-display text-[5.6cqw] leading-[1.12]">{slide.judul}</h2>
              {jenis === "kajian" && (
                <dl className="mt-[2.6cqw] space-y-[1.2cqw] text-[2.7cqw]">
                  {slide.penceramah && (
                    <div><dt className="text-[1.9cqw] text-ink-500">Penceramah</dt><dd className="font-semibold">{slide.penceramah}</dd></div>
                  )}
                  {slide.waktuKegiatan && (
                    <div><dt className="text-[1.9cqw] text-ink-500">Waktu</dt><dd className="font-semibold">{labelWaktuLokal(slide.waktuKegiatan, zona)}</dd></div>
                  )}
                  {slide.lokasi && (
                    <div><dt className="text-[1.9cqw] text-ink-500">Tempat</dt><dd className="font-semibold">{slide.lokasi}</dd></div>
                  )}
                </dl>
              )}
              {slide.isi && (
                <p className={`mt-[2.4cqw] whitespace-pre-line text-[2.7cqw] leading-snug text-ink-500 ${jenis === "kajian" ? "line-clamp-3" : "line-clamp-[8]"}`}>{slide.isi}</p>
              )}
            </div>
            {slide.gambar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.gambar} alt="" className="h-full min-h-0 w-full rounded-[1.2cqw] bg-forest-50 object-contain" />
            )}
          </div>
        )}
      </article>
    </div>
  );
}

function IsiKas({ judul, kas }: { judul: string; kas: RingkasanKasTv | null }) {
  if (!kas) {
    // Hanya terlihat di pratinjau panel: layar TV tidak pernah memutar slide
    // kas tanpa ringkasan yang dipublikasikan.
    return (
      <div className="mt-[2cqw]">
        <h2 className="font-display text-[5cqw] leading-tight">{judul}</h2>
        <p className="mt-[2cqw] text-[2.6cqw] text-ink-500">Publikasi kas sedang mati, jadi slide ini tidak tampil di TV. Admin dapat menyalakannya di Buku Kas, Publikasi ke jamaah.</p>
      </div>
    );
  }
  return (
    <div className="mt-[1.5cqw] flex min-h-0 flex-1 flex-col">
      <h2 className="font-display text-[4.6cqw] leading-tight">{judul}</h2>
      <p className="mt-[0.6cqw] text-[2.3cqw] text-ink-500">{kas.periode}</p>
      <dl className="mt-[3cqw] grid grid-cols-2 gap-x-[3cqw] gap-y-[2.4cqw]">
        {kas.dari && (
          <div><dt className="text-[2cqw] text-ink-500">Saldo awal</dt><dd className="text-[3.6cqw] font-semibold tabular-nums">{rp(kas.saldoAwal)}</dd></div>
        )}
        <div><dt className="text-[2cqw] text-ink-500">Pemasukan</dt><dd className="text-[3.6cqw] font-semibold tabular-nums text-forest-700">{rp(kas.masuk)}</dd></div>
        <div><dt className="text-[2cqw] text-ink-500">Pengeluaran</dt><dd className="text-[3.6cqw] font-semibold tabular-nums text-red-700">{rp(kas.keluar)}</dd></div>
        <div className="rounded-[1.2cqw] bg-forest-800 px-[2cqw] py-[1.2cqw] text-paper">
          <dt className="text-[2cqw] text-forest-100">Saldo akhir</dt>
          <dd className="text-[4cqw] font-semibold tabular-nums">{rp(kas.saldoAkhir)}</dd>
        </div>
      </dl>
      {kas.dana.length > 1 && (
        <p className="mt-auto pt-[2cqw] text-[2.1cqw] text-ink-500">
          {kas.dana.map((d) => `${d.nama} ${rp(d.saldo)}`).join("  ·  ")}
        </p>
      )}
    </div>
  );
}
