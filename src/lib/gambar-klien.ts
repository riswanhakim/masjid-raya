/**
 * Potong foto ke 16:9 di browser sebelum diunggah: bagian tengah diambil,
 * lalu diperkecil paling besar 1920×1080. Layar TV 16:9 jadi terisi tanpa
 * ruang kosong, dan berkas yang diunggah lebih kecil.
 */
export async function potong16x9(berkas: File): Promise<File> {
  const bitmap = await createImageBitmap(berkas);
  try {
    const rasio = 16 / 9;
    let lebar = bitmap.width;
    let tinggi = Math.round(lebar / rasio);
    if (tinggi > bitmap.height) {
      tinggi = bitmap.height;
      lebar = Math.round(tinggi * rasio);
    }
    const sx = Math.round((bitmap.width - lebar) / 2);
    const sy = Math.round((bitmap.height - tinggi) / 2);
    const skala = Math.min(1, 1920 / lebar);
    const kanvas = document.createElement("canvas");
    kanvas.width = Math.round(lebar * skala);
    kanvas.height = Math.round(tinggi * skala);
    const ctx = kanvas.getContext("2d");
    if (!ctx) throw new Error("Peramban tidak mendukung pemrosesan gambar");
    ctx.drawImage(bitmap, sx, sy, lebar, tinggi, 0, 0, kanvas.width, kanvas.height);
    const blob = await new Promise<Blob | null>((r) => kanvas.toBlob(r, "image/jpeg", 0.88));
    if (!blob) throw new Error("Foto gagal diproses");
    return new File([blob], berkas.name.replace(/\.[^.]+$/, "") + "-16x9.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

/**
 * Perkecil foto besar (mis. dari kamera HP) sebelum diunggah: sisi terpanjang
 * paling besar 2000 px, JPEG. Menjaga unggahan di bawah batas 4 MB server.
 * Berkas kecil, GIF, dan PNG (bisa transparan, mis. logo) tidak diubah.
 */
export async function kecilkanGambar(berkas: File, sisiMaks = 2000): Promise<File> {
  if (!berkas.type.startsWith("image/") || /gif|png|svg/.test(berkas.type)) return berkas;
  if (berkas.size < 1024 * 1024) return berkas;
  try {
    const bitmap = await createImageBitmap(berkas);
    try {
      const skala = Math.min(1, sisiMaks / Math.max(bitmap.width, bitmap.height));
      const kanvas = document.createElement("canvas");
      kanvas.width = Math.round(bitmap.width * skala);
      kanvas.height = Math.round(bitmap.height * skala);
      const ctx = kanvas.getContext("2d");
      if (!ctx) return berkas;
      ctx.drawImage(bitmap, 0, 0, kanvas.width, kanvas.height);
      const blob = await new Promise<Blob | null>((r) => kanvas.toBlob(r, "image/jpeg", 0.85));
      return blob && blob.size < berkas.size ? new File([blob], berkas.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : berkas;
    } finally {
      bitmap.close();
    }
  } catch {
    // Format yang tidak bisa dibaca peramban: kirim apa adanya, server yang memutuskan.
    return berkas;
  }
}
