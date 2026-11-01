# Panduan Deploy Otonom Institute

Data pendaftar disimpan di file SQLite, jadi server **wajib punya disk
permanen (volume) di `/data`**. Tanpa volume, semua pendaftar hilang setiap
kali server di-restart atau di-deploy ulang.

Variabel yang wajib diatur di semua platform:

| Variabel | Nilai |
|---|---|
| `ADMIN_TOKEN` | Token acak panjang untuk login `/admin`, mis. hasil `openssl rand -hex 32` |
| `TRUST_PROXY` | `1` |
| `DB_PATH` | `/data/otonom.db` (sudah default di Dockerfile) |

Setelah deploy, cek:
1. `https://<domain>/healthz` → `{"ok":true}`
2. `https://<domain>/` → beranda tampil
3. `https://<domain>/admin` → bisa login dengan `ADMIN_TOKEN`

---

## Opsi A: Railway (disarankan, paling mudah)

1. Buka https://railway.com dan login dengan GitHub.
2. **New Project → Deploy from GitHub repo →** pilih `moltnbook`.
   Railway otomatis membaca `Dockerfile` dan `railway.json`.
3. Di service yang terbentuk, buka **Settings → Volumes → Add Volume**,
   isi *Mount path* dengan `/data`.
4. Tab **Variables**, tambahkan `ADMIN_TOKEN` dan `TRUST_PROXY=1`.
5. **Settings → Networking → Generate Domain** untuk mendapat URL publik
   (`*.up.railway.app`). Domain sendiri bisa ditambahkan di tempat yang sama.

## Opsi B: Render

1. Buka https://render.com dan login dengan GitHub.
2. **New → Blueprint**, pilih repo ini. Render membaca `render.yaml`:
   web service Docker, disk 1 GB di `/data`, dan `ADMIN_TOKEN` acak otomatis.
3. Setelah selesai, lihat nilai `ADMIN_TOKEN` di tab **Environment** service.

> Disk permanen di Render hanya tersedia di paket berbayar (Starter ke atas).

## Opsi C: Fly.io

Butuh CLI `flyctl` (https://fly.io/docs/flyctl/install/).

```bash
fly auth login
fly launch --no-deploy --copy-config     # pilih nama app yang unik
fly volumes create otonom_data --size 1 --region sin
fly secrets set ADMIN_TOKEN=$(openssl rand -hex 32)
fly deploy
```

Jalankan **satu mesin saja** (SQLite tidak bisa dibagi antar mesin).
Lihat token dengan menyimpannya sebelum `fly secrets set`, karena Fly tidak
menampilkan nilai secret setelah disimpan.

## Opsi D: VPS sendiri (DigitalOcean, Hetzner, IDCloudHost, Biznet Gio, dll.)

Di server yang sudah terpasang Docker:

```bash
git clone https://github.com/biloet/moltnbook.git otonom && cd otonom
docker build -t otonom .
docker run -d --name otonom --restart unless-stopped \
  -p 127.0.0.1:3000:3000 -v otonom_data:/data \
  -e TRUST_PROXY=1 -e ADMIN_TOKEN=$(openssl rand -hex 32) otonom
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' otonom | grep ADMIN_TOKEN
```

Pasang Caddy untuk HTTPS otomatis (`/etc/caddy/Caddyfile`):

```
domainanda.com {
    reverse_proxy 127.0.0.1:3000
}
```

Arahkan DNS (A record) domain ke IP server, lalu `systemctl reload caddy`.

Update ke versi terbaru:

```bash
git pull && docker build -t otonom . && docker rm -f otonom && docker run ...  # perintah run yang sama
```

---

## Backup

Salin file `/data/otonom.db` secara berkala. Cara paling mudah: unduh CSV dari
halaman `/admin`.
