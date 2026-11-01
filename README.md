# Otonom Institute

Situs untuk lembaga/komunitas yang membantu founder membangun **perusahaan yang
dijalankan oleh tim agen AI**. Manusia menentukan arah, agen mengerjakan
operasional.

## Halaman

| URL | Isi |
|---|---|
| `/` | Beranda: konsep, cara kerja, program, FAQ, ajakan mendaftar, sisa kuota anggota |
| `/skills` | Direktori skill agen dengan pencarian dan filter kategori |
| `/pendanaan` | Peta hibah/pendanaan dengan skor kecocokan, filter wilayah, urutan tenggat |
| `/daftar` | Formulir pengajuan keanggotaan (tersimpan di SQLite) |

## Menjalankan

Butuh Node.js ≥ 22.13.

```bash
npm install
ADMIN_TOKEN=ganti-dengan-token-rahasia npm start   # http://localhost:3000
npm test
```

## Mengubah isi

- **Teks halaman**: edit file di `public/*.html`.
- **Nama & menu**: `public/assets/site.js` (navigasi dan footer bersama).
- **Warna & font**: variabel di bagian atas `public/assets/style.css`.
- **Daftar skill**: `public/data/skills.json`.
- **Daftar pendanaan**: `public/data/pendanaan.json`. Data bawaan **hanya contoh**;
  ganti dengan program nyata dan cantumkan `url` situs resmi. Setelah diganti,
  hapus juga banner peringatan di `public/pendanaan.html`.

## Mengelola pendaftar

Semua endpoint admin butuh header `Authorization: Bearer <ADMIN_TOKEN>`.

```bash
# Lihat semua pendaftar (JSON)
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3000/api/admin/applications

# Unduh sebagai CSV (bisa dibuka di Excel/Google Sheets)
curl -H "Authorization: Bearer $ADMIN_TOKEN" -o pendaftar.csv \
  "http://localhost:3000/api/admin/applications?format=csv"

# Terima / tolak pendaftar (status: pending | accepted | rejected)
curl -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"accepted"}' http://localhost:3000/api/admin/applications/1
```

Pendaftar yang diterima (`accepted`) mengurangi angka "Kursi tersisa" di beranda.

## Konfigurasi

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `DB_PATH` | `data/otonom.db` | File SQLite untuk data pendaftar |
| `ADMIN_TOKEN` | (kosong) | Token untuk endpoint admin; wajib diisi agar admin aktif |
| `MEMBER_CAP` | `500` | Batas jumlah anggota |
| `APPLY_LIMIT_PER_HOUR` | `5` | Batas pengajuan per IP per jam (`0` = tanpa batas) |
| `TRUST_PROXY` | `loopback` | Isi `1` jika berjalan di belakang reverse proxy (Railway, Render, dll.) |

## Deploy

Tersedia `Dockerfile`. Pasang volume permanen ke `/data` agar data pendaftar
tidak hilang saat redeploy, lalu atur `ADMIN_TOKEN` dan `TRUST_PROXY=1`.
