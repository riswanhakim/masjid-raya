import type { Metadata } from "next";
import FormTayangan from "@/components/admin/tayangan/FormTayangan";
import { ringkasanKasPublik, zonaMasjid } from "@/lib/data-kas";
import { JENIS_SLIDE, isoKeLokal, type JenisSlide } from "@/lib/tv";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buat Tayangan" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  const { jenis } = await searchParams;
  const [zona, kas] = await Promise.all([zonaMasjid(), ringkasanKasPublik()]);
  const sekarang = isoKeLokal(new Date(), zona);
  // Bawaan: mulai sekarang, berakhir tujuh hari lagi pukul 23.59 waktu masjid.
  const akhir = `${isoKeLokal(new Date(Date.now() + 7 * 86400000), zona).slice(0, 10)}T23:59`;
  return (
    <FormTayangan
      zona={zona}
      kas={kas}
      awal={{
        jenis: (JENIS_SLIDE as readonly string[]).includes(jenis ?? "") ? (jenis as JenisSlide) : "kajian",
        judul: "", isi: "", gambar: null, penceramah: "", waktuKegiatan: "", lokasi: "", tampilan: "standar",
        mulai: sekarang, selesai: akhir, durasi: "15", urutan: "0", aktif: true,
      }}
    />
  );
}
