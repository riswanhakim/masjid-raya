import { formatDurasi } from "@/lib/papan";
import type { StatusSinkron } from "./usePaketTv";

/**
 * Layar penuh waktu shalat. Menutup seluruh papan dari masuk waktu sampai
 * iqomah (hitung mundur besar), lalu "shalat berlangsung" selama durasi yang
 * diatur admin. Latar gelap dan tenang agar tidak menyilaukan saat shalat.
 */
export function LayarShalat({
  namaMasjid,
  nama,
  jamSekarang,
  iqomahSisa,
  iqomahTotal,
  sedangShalat,
  onTutup,
}: {
  namaMasjid: string;
  nama: string;
  jamSekarang: string;
  iqomahSisa: number | null;
  iqomahTotal: number;
  sedangShalat: boolean;
  /** Hanya untuk mode jendela biasa (operator); di layar penuh TV tidak ada tombol. */
  onTutup?: () => void;
}) {
  const persen = iqomahSisa != null && iqomahTotal > 0 ? Math.min(100, Math.max(0, ((iqomahTotal - iqomahSisa) / iqomahTotal) * 100)) : 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={sedangShalat ? `Shalat ${nama} sedang berlangsung` : `Hitung mundur iqomah ${nama}`}
      className={`fixed inset-0 z-50 flex flex-col text-paper ${sedangShalat ? "bg-forest-950" : "bg-forest-900"}`}
    >
      <div className="flex items-center justify-between gap-4 px-[4vw] pt-[3vh] text-[clamp(0.9rem,1.6vw,1.6rem)] text-forest-100">
        <span className="truncate">{namaMasjid}</span>
        <span className="font-mono tabular-nums">{jamSekarang}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-[4vw] text-center" aria-live="polite">
        {sedangShalat ? (
          <>
            <p className="text-[clamp(1rem,2.4vw,2.6rem)] uppercase tracking-[0.25em] text-forest-200">Shalat berjamaah</p>
            <p className="mt-[2vh] font-display text-[clamp(4rem,14vw,16rem)] leading-none">{nama}</p>
            <p className="mt-[4vh] max-w-[40ch] text-[clamp(1rem,2.2vw,2.4rem)] text-forest-100">
              Sedang berlangsung. Mohon senyapkan ponsel.
            </p>
          </>
        ) : (
          <>
            <p className="text-[clamp(1rem,2.4vw,2.6rem)] uppercase tracking-[0.25em] text-forest-200">Telah masuk waktu</p>
            <p className="mt-[1vh] font-display text-[clamp(3.5rem,11vw,12rem)] leading-none">{nama}</p>
            <p className="mt-[5vh] text-[clamp(1rem,2.4vw,2.6rem)] text-forest-100">Iqomah dalam</p>
            <p className="font-mono text-[clamp(5rem,20vw,22rem)] font-bold leading-none tabular-nums">
              {iqomahSisa != null ? formatDurasi(iqomahSisa) : "--:--"}
            </p>
            <div className="mt-[4vh] h-[clamp(6px,0.8vh,12px)] w-[min(70vw,1100px)] overflow-hidden rounded-full bg-forest-950/60">
              <div className="h-full rounded-full bg-mint transition-[width] duration-1000 ease-linear" style={{ width: `${persen}%` }} />
            </div>
            <p className="mt-[3vh] text-[clamp(1rem,2vw,2.2rem)] text-forest-100">Luruskan dan rapatkan shaf.</p>
          </>
        )}
      </div>

      {onTutup && (
        <div className="flex justify-center pb-[3vh]">
          <button type="button" onClick={onTutup} className="btn min-h-11 border border-forest-100/40 text-paper hover:bg-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">
            Kembali ke papan
          </button>
        </div>
      )}
    </div>
  );
}

const jam = (iso: string | null, zona: string) =>
  iso ? new Intl.DateTimeFormat("id-ID", { timeZone: zona, hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "belum pernah";

/** Status sinkron untuk operator (hanya terlihat di luar mode layar penuh). */
export function StatusOperator({
  status,
  zona,
  jadwalTersedia,
  adzanLokal,
  murottalAktif,
}: {
  status: StatusSinkron;
  zona: string;
  jadwalTersedia: boolean;
  adzanLokal: boolean | null;
  murottalAktif: boolean;
}) {
  const kurang: string[] = [];
  if (status.hariJadwalTersimpan < 7) kurang.push(`jadwal baru ${status.hariJadwalTersimpan} hari`);
  if (status.aset.siap < status.aset.total) kurang.push(`foto/suara ${status.aset.siap} dari ${status.aset.total}`);
  if (!status.swAktif) kurang.push("halaman belum tersimpan untuk dibuka ulang offline");

  return (
    <div className="mt-3 border-t border-forest-900/10 pt-3 text-xs text-ink-500" aria-live="polite">
      <p className="font-semibold text-forest-900">
        {status.online ? "Tersambung" : "Offline"}: data tayangan {status.online ? "diperbarui" : "terakhir"} pukul {jam(status.terakhirSinkron, zona)}
      </p>
      {!jadwalTersedia && <p className="mt-1 text-red-700">Jadwal shalat hari ini belum tersedia. Sambungkan internet agar jadwal termuat.</p>}
      <p className="mt-1">
        {kurang.length === 0 ? "Siap offline: jadwal 7 hari, foto, dan halaman tersimpan." : `Belum sepenuhnya siap offline: ${kurang.join(", ")}.`}
      </p>
      <p className="mt-1">
        {adzanLokal === null ? "Suara adzan mati." : adzanLokal ? "Suara adzan tersimpan di perangkat." : "Sebagian suara adzan diambil dari internet dan tidak berbunyi saat offline. Unggah suara adzan di Pengaturan agar tersimpan di perangkat."}
        {murottalAktif && " Murottal selalu memerlukan internet."}
      </p>
    </div>
  );
}
