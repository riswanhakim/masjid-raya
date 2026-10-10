import type { Metadata } from "next";
import FormKas from "@/components/admin/FormKas";
import { daftarDana, daftarKategori, hariIniMasjid } from "@/lib/data-kas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Catat Transaksi" };

export default async function Halaman() {
  const [hariIni, dana, kategori] = await Promise.all([hariIniMasjid(), daftarDana(true), daftarKategori()]);
  const namaDana = dana.map((d) => d.nama);
  return (
    <FormKas
      dana={namaDana}
      kategori={kategori}
      awal={{ tanggal: hariIni, jenis: "masuk", kategori: "", keterangan: "", jumlah: "", dana: namaDana[0] ?? "", bukti: null }}
    />
  );
}
