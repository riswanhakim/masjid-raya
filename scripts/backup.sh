#!/bin/sh
set -eu
: "${BACKUP_DIR:?Tetapkan BACKUP_DIR ke direktori backup di luar volume aplikasi}"
: "${DATABASE_URL:?DATABASE_URL wajib diisi}"
: "${UPLOAD_DIR:?UPLOAD_DIR wajib diisi}"
case "$DATABASE_URL" in file:/*) database_path=${DATABASE_URL#file:} ;; *) echo "Gunakan DATABASE_URL absolut file:/..." >&2; exit 1 ;; esac
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_target="$BACKUP_DIR/$backup_stamp"
umask 077
mkdir -p "$backup_target"
sqlite3 "$database_path" ".backup '$backup_target/masjid.db'"
tar -czf "$backup_target/uploads.tar.gz" -C "$UPLOAD_DIR" .
echo "Backup tersimpan: $backup_target"
