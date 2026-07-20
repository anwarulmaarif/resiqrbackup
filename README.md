# ResiQR Backup

ResiQR Backup adalah ekstensi browser Chrome/Edge yang membantu menambahkan QR code cadangan ke file PDF resi Lion Parcel. Tujuan utamanya adalah menyediakan salinan nomor STT sebagai backup jika barcode utama rusak atau tidak terbaca oleh scanner.

## Tentang Aplikasi

Ekstensi ini bekerja secara otomatis saat Anda membuka resi Lion Parcel di browser. Saat PDF dibuka, ekstensi akan menyisipkan QR code backup ke halaman PDF yang sedang ditampilkan, sehingga nomor resi tetap dapat dipindai atau dicatat sebagai cadangan.

## Fitur Utama

- Mendeteksi nomor resi secara otomatis dari halaman Lion Parcel
- Menambahkan QR code backup ke file PDF yang dibuka
- Bekerja pada PDF yang dihasilkan dalam format blob/browser
- Tidak perlu mengubah file PDF manual
- Mudah dikustomisasi untuk posisi dan ukuran QR code

## Catatan Penting

Ekstensi ini tidak tersedia di Chrome Web Store karena belum dipublikasikan. Karena itu, instalasi dilakukan secara manual melalui mode Load unpacked.

## Prasyarat

- Google Chrome atau Microsoft Edge terbaru
- Akses internet ke situs Lion Parcel
- Izin untuk menginstal ekstensi dari sumber lokal

## Cara Install

1. Buka Google Chrome atau Microsoft Edge.
2. Akses halaman ekstensi:
   - Chrome: chrome://extensions
   - Edge: edge://extensions
3. Aktifkan opsi Developer mode.
4. Klik tombol Load unpacked.
5. Pilih folder proyek ini sebagai lokasi ekstensi.
6. Jika berhasil, ekstensi akan muncul di daftar ekstensi dan siap digunakan.

## Cara Pakai

1. Setelah instalasi selesai tab Genesis lama wajib di tutup dan buka tab Genesis baru agar ektensi dapat bekerja.
2. Buka situs Genesis Lion Parcel di browser.
3. Buka halaman resi yang ingin Anda lihat.
4. Saat PDF resi terbuka, ekstensi akan otomatis menambahkan QR code backup.
5. Jika Anda ingin memeriksa apakah ekstensi berjalan, buka Developer Tools dan lihat console browser untuk log yang dimulai dengan "[ResiQRBackup]".

## Struktur Folder

- manifest.json: konfigurasi ekstensi Chrome
- inject.js: script utama yang menangani penyisipan QR ke PDF
- libs/: library pendukung untuk PDF dan QR code

## Penyesuaian

Jika Anda ingin mengubah posisi, ukuran, atau target halaman QR code, Anda dapat mengedit konfigurasi di bagian CONFIG pada file inject.js.

## Troubleshooting

Jika QR code tidak muncul:

- Pastikan ekstensi sudah aktif di halaman ekstensi
- Pastikan browser sedang membuka domain Lion Parcel yang didukung
- Coba refresh halaman resi
- Periksa console browser jika ada error

## Pengembang

Dikembangkan oleh Anwarul Maarif.
