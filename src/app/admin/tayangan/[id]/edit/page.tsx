import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import FormTayangan from "@/components/admin/tayangan/FormTayangan";
import { ringkasanKasPublik, zonaMasjid } from "@/lib/data-kas";
import { isoKeLokal, type JenisSlide } from "@/lib/tv";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit Tayangan" };

export default async function Halaman({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s, zona, kas] = await Promise.all([prisma.tvSlide.findUnique({ where: { id } }), zonaMasjid(), ringkasanKasPublik()]);
  if (!s) notFound();
  return (
    <FormTayangan
      id={id}
      zona={zona}
      kas={kas}
      awal={{
        jenis: s.jenis as JenisSlide,
        judul: s.judul,
        isi: s.isi ?? "",
        gambar: s.gambar,
        penceramah: s.penceramah ?? "",
        waktuKegiatan: s.waktuKegiatan ? isoKeLokal(s.waktuKegiatan, zona) : "",
        lokasi: s.lokasi ?? "",
        tampilan: s.tampilan === "foto" ? "foto" : "standar",
        mulai: isoKeLokal(s.mulai, zona),
        selesai: isoKeLokal(s.selesai, zona),
        durasi: String(s.durasi),
        urutan: String(s.urutan),
        aktif: s.aktif,
      }}
    />
  );
}
