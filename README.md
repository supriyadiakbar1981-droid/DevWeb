# RAME! — Party Game Multiplayer

Website party game multiplayer real-time: **Tebak Kata**, **Tebak Gambar**,
**Kuis Tim**, dan **Duel 1v1** — lengkap dengan sistem **login/daftar**,
**login admin**, **poin (top up manual oleh admin)**, **pantau user online
real-time**, dan **blokir akun**.

100% gratis untuk dijalankan selamanya, dan bisa di-deploy ke **GitHub Pages**.

## Kenapa butuh Firebase?

GitHub Pages hanya bisa menghosting file statis (HTML/CSS/JS) — tidak ada
server. Supaya fitur **login, real-time room, poin, dan panel admin** beneran
berfungsi (bukan cuma tampilan), website ini pakai **Firebase** sebagai
backend gratis (paket Spark, gratis selamanya untuk skala pemakaian normal):

- **Firebase Authentication** → login & daftar akun
- **Cloud Firestore** → data user, poin, room, soal, permintaan top up
- **Realtime Database** → status online/offline user secara real-time

Frontend (semua file di folder ini) tetap 100% statis dan bisa di-deploy ke
GitHub Pages seperti biasa. Firebase hanya dipanggil dari browser lewat SDK.

## 1. Setup Firebase (sekali saja, ±10 menit)

1. Buka [console.firebase.google.com](https://console.firebase.google.com) →
   **Add project** → beri nama bebas (misal `rame-partygame`) → lanjut
   sampai selesai (Google Analytics boleh dimatikan).
2. Di sidebar, klik **Build → Authentication → Get started** → tab
   **Sign-in method** → aktifkan **Email/Password**.
3. Klik **Build → Firestore Database → Create database** → pilih lokasi
   server (misal `asia-southeast1`) → mode **Production**.
4. Klik **Build → Realtime Database → Create database** → pilih lokasi →
   mode **Locked**.
5. Klik ikon gear ⚙️ → **Project settings** → scroll ke **Your apps** →
   klik ikon web `</>` → beri nama app → **Register app**. Firebase akan
   menampilkan objek `firebaseConfig` — **copy semua nilainya**.
6. Buka file `js/firebase-config.js` di project ini, ganti seluruh isi
   `firebaseConfig` dengan nilai yang kamu copy tadi. Juga cek
   `databaseURL` (ambil dari tab Realtime Database di console, biasanya
   bentuknya `https://NAMA-PROJECT-default-rtdb.REGION.firebasedatabase.app`).

### Pasang security rules (wajib, supaya data aman)

1. Di **Firestore Database → Rules**, hapus isi default lalu copy-paste
   seluruh isi file `firestore.rules` dari project ini → **Publish**.
2. Di **Realtime Database → Rules**, copy-paste seluruh isi file
   `database.rules.json` dari project ini → **Publish**.

Selesai! Backend sudah siap.

## 2. Coba jalankan lokal

Karena pakai ES module (`type="module"`), buka lewat local server, bukan
`file://` langsung. Paling gampang:

```bash
# dari dalam folder project ini
python3 -m http.server 8080
# lalu buka http://localhost:8080
```

Atau pakai ekstensi **Live Server** di VS Code.

## 3. Deploy ke GitHub Pages (gratis)

1. Buat repository baru di GitHub, upload seluruh isi folder ini (jangan
   lupa `js/firebase-config.js` yang sudah kamu isi config asli).
2. Buka repo → **Settings → Pages** → di **Source**, pilih branch `main`
   dan folder `/ (root)` → **Save**.
3. Tunggu 1–2 menit, GitHub akan kasih link `https://username.github.io/nama-repo/`.

Website kamu sekarang online dan bisa diakses siapa saja, gratis, permanen.

> **Catatan keamanan domain:** secara default Firebase Authentication
> membatasi domain yang boleh memakainya. Kalau muncul error
> `auth/unauthorized-domain`, buka **Authentication → Settings →
> Authorized domains** di Firebase console, lalu tambahkan domain GitHub
> Pages kamu (`username.github.io`).

## 4. Login sebagai Admin

Buka halaman **Login Admin** (link ada di footer halaman login user, atau
langsung ke `admin-login.html`), lalu masuk dengan:

- **Username:** `admin`
- **Password:** `admin12345`

Login pertama kali akan **otomatis membuat akun admin** di project
Firebase kamu (tidak perlu setup manual tambahan). Setelah itu admin bisa:

- Melihat **semua user + status online/offline real-time**
- **Mengisi poin** user kapan saja, langsung bertambah real-time di layar
  user tanpa perlu refresh
- Melihat & **menyetujui/menolak permintaan top up**
- **Memblokir/membuka blokir** akun — user yang diblokir otomatis ter-logout
  saat itu juga meski sedang online

Kamu bisa (dan disarankan) mengganti password admin lewat menu
**Authentication → Users** di Firebase console setelah deploy, supaya
lebih aman dari password default.

## 5. Alur poin

- User daftar → poin awal **0**.
- User klik **Top Up Poin** di dashboard → masuk sebagai permintaan pending
  ke admin.
- Admin buka panel admin → **setujui** (poin otomatis masuk) atau isi poin
  langsung ke user manapun tanpa perlu ada permintaan dulu.
- Poin dipakai untuk:
  - **Buat Room** — biaya diatur di `COST_CREATE_ROOM` (`js/firebase-config.js`, default 50 poin)
  - **Buat Set Soal** — biaya diatur di `COST_CREATE_QUESTION_SET` (default 20 poin)
- Akun **admin tidak dikenakan biaya poin** untuk membuat room/soal.

Ubah angka biaya sesuka hati di `js/firebase-config.js`.

## 6. Struktur project

```
index.html            Landing page
register.html          Daftar akun user
login.html              Login user
admin-login.html        Login admin
dashboard.html / js/dashboard.js   Dashboard user: poin, top up, buat/gabung room
create-soal.html / js/create-soal.js   Buat set soal (kata/gambar/kuis)
room.html / js/room.js  Room real-time: waiting → playing → finished
admin.html / js/admin.js  Panel admin
css/style.css            Semua styling
js/firebase-config.js     Konfigurasi Firebase (ISI DULU!)
js/auth.js                Register/login/logout + guard halaman
js/presence.js             Status online/offline real-time (Realtime DB)
js/points.js                Semua transaksi poin & top up
js/questions.js              CRUD set soal
js/rooms.js                   Room, join, jawaban, ronde
firestore.rules / database.rules.json   Security rules
```

## 7. Cara main

1. Daftar akun → minta top up poin ke admin.
2. Setelah dapat poin, buat **set soal** (Tebak Kata / Tebak Gambar / Kuis
   Tim) atau pakai set soal yang sudah ada.
3. Buat **room** (pilih mode: Tebak Kata, Tebak Gambar, Kuis Tim, atau
   Duel 1v1) — dapat **kode room 6 karakter**.
4. Share kode ke teman, mereka tinggal masuk dashboard → **Gabung Room** →
   masukkan kode (atau pilih dari daftar "Room Menunggu Pemain").
5. Kalau pemain sudah cukup, host tekan **Mulai Permainan**. Semua pemain
   melihat soal & skor secara real-time di layar masing-masing.
6. **Tebak Kata/Gambar/Duel:** siapa ketik jawaban benar duluan, menang
   ronde (+10 poin skor).
7. **Kuis Tim:** pemain otomatis dibagi Tim A/B, jawab pilihan ganda,
   skor terkumpul ke skor tim.
8. Host bisa lanjut ke **Ronde Berikutnya** kapan saja. Soal terakhir
   selesai → layar hasil akhir & pemenang muncul otomatis.

## 8. Batasan yang perlu kamu tahu

Ini website statis murni (tanpa server sendiri), jadi ada beberapa
batasan yang wajar untuk aplikasi party game gratisan:

- **Jawaban soal disimpan di Firestore dan bisa dibaca lewat DevTools**
  oleh pemain yang benar-benar niat membuka console browser. Untuk party
  game santai bareng teman ini bukan masalah; kalau butuh anti-cheat
  tingkat kompetisi, solusinya menambah **Cloud Functions** (butuh paket
  Blaze, ada free tier tapi perlu kartu kredit terdaftar) yang menyimpan
  jawaban di server. Di luar cakupan setup gratis-tanpa-kartu-kredit ini.
- Sistem poin & blokir sudah diamankan lewat **Firestore security rules**
  (hanya admin yang bisa mengubah `points`/`isBlocked`/`isAdmin`), jadi
  user biasa tidak bisa mengisi poin sendiri lewat DevTools.
- Firebase paket gratis (Spark) punya kuota harian (lebih dari cukup untuk
  pemakaian teman-teman/komunitas kecil–menengah). Kalau website jadi
  sangat ramai, cek [batas kuota Spark](https://firebase.google.com/pricing)
  di dokumentasi resmi.

Selamat main! 🎉
