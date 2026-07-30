(function () {
  'use strict';

  // ================== KONFIGURASI (kalibrasi posisi QR di sini) ==================
  const CONFIG = {
    // Title PDF harus mengandung kata ini (case-insensitive) supaya dianggap "resi".
    // Pengaman tambahan biar nggak ke-trigger dokumen lain yang kebetulan ada nomor STT-nya.
    TITLE_MUST_CONTAIN: /resi/i,

    // Pola nomor resi Lion Parcel: 2 digit + 2 huruf + digit panjang (contoh: 11LP1785157457710).
    // Dicari di MANA PUN di dalam Title, nggak peduli struktur nama file di sekitarnya.
    RESI_NUMBER_PATTERN: /\d{2}[A-Z]{2}\d{8,}/i,

    // Posisi QR: X fixed (point), karena posisi horizontal konten resi selalu sama
    // baik di kertas thermal maupun A4 (kontennya nempel di kiri, bukan di-scale).
    QR_X: 140,

    // Y dihitung dari JARAK-DARI-ATAS halaman (bukan fraction dari tinggi total!),
    // karena konten resi selalu nempel di ATAS halaman -- sisa kertas kosong di bawah
    // itu cuma buffer buat A4 (biar bisa dipotong manual), bukan bagian dari label.
    // PDF pakai origin kiri-BAWAH, makanya nanti dikonversi: y = tinggi_halaman - offset - ukuran.
    // Angka di bawah ini masih TEBAKAN AWAL, perlu dikalibrasi manual lihat hasil cetak.
    QR_OFFSET_FROM_TOP: 230,

    TARGET_PAGE_INDEX: 0,

    // Ukuran QR dalam POINT TETAP (bukan persentase). Ini SENGAJA fixed, karena ukuran
    // fisik resi (barcode, teks, dst) selalu sama -- yang berubah cuma ukuran kanvas/kertasnya,
    // bukan ukuran kontennya. Kalau ikut persentase lebar halaman, QR jadi ikut membesar
    // di kertas A4 padahal harusnya tetap sekecil di thermal.
    QR_SIZE: 60,

    DEBUG: true,
  };
  // ===================================================================================

  const log = (...args) => CONFIG.DEBUG && console.log('[ResiQRBackup]', ...args);

  // Map: original blob URL -> Promise<modified blob URL>
  const pendingModifications = new Map();

  // ---------- Hook createObjectURL: deteksi blob PDF, cek Title-nya, suntik QR kalau match ----------
  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (blob) {
    const originalUrl = originalCreateObjectURL(blob);

    const looksLikePdfBlob =
      blob instanceof Blob &&
      (blob.type === 'application/pdf' || blob.type === '' || blob.type === 'application/octet-stream') &&
      blob.size > 500;

    if (looksLikePdfBlob) {
      log('Blob PDF terdeteksi, cek Title metadata...', originalUrl);
      const modPromise = injectQrIfResi(blob)
        .then((modifiedBlob) => {
          if (modifiedBlob === null) {
            log('Title tidak cocok pola resi, dilewati (tidak diubah).');
            return originalUrl;
          }
          const modifiedUrl = originalCreateObjectURL(modifiedBlob);
          log('Versi PDF + QR siap:', modifiedUrl);
          return modifiedUrl;
        })
        .catch((err) => {
          console.error('[ResiQRBackup] Gagal proses PDF, pakai versi asli:', err);
          return originalUrl; // fallback: pakai url asli kalau gagal
        });

      pendingModifications.set(originalUrl, modPromise);
    }

    return originalUrl;
  };

  // ---------- Hook window.open: begitu tab baru dibuka dgn URL yg sedang diproses, redirect ke versi ber-QR ----------
  const originalWindowOpen = window.open.bind(window);
  window.open = function (url, ...rest) {
    const win = originalWindowOpen(url, ...rest);

    if (url && pendingModifications.has(url) && win) {
      pendingModifications.get(url).then((modifiedUrl) => {
        if (modifiedUrl !== url) {
          log('Redirect tab ke versi ber-QR...', modifiedUrl);
          try {
            win.location.href = modifiedUrl;
          } catch (err) {
            console.error('[ResiQRBackup] Gagal redirect tab ke versi modifikasi:', err);
          }
        }
      });
    }

    return win;
  };

  // ---------- FALLBACK: kalau bukan window.open, mungkin dibuka lewat <a href="blob:..." target="_blank"> + click() ----------
  document.addEventListener(
    'click',
    (e) => {
      const anchor = e.target.closest && e.target.closest('a[href^="blob:"]');
      if (!anchor) return;
      const url = anchor.href;

      if (pendingModifications.has(url)) {
        pendingModifications.get(url).then((modifiedUrl) => {
          if (modifiedUrl !== url) {
            log('Update href anchor ke versi ber-QR (untuk klik berikutnya):', modifiedUrl);
            anchor.href = modifiedUrl;
          }
        });
      }
    },
    true // capture phase, supaya kedeteksi sebelum event handler asli
  );

  // ---------- Helper utama: cek Title, kalau cocok pola resi -> suntik QR ----------
  async function injectQrIfResi(blob) {
    const pdfBytes = new Uint8Array(await blob.arrayBuffer());
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const title = pdfDoc.getTitle() || '';
    log('Title metadata PDF:', JSON.stringify(title));

    if (!CONFIG.TITLE_MUST_CONTAIN.test(title)) {
      return null; // Title nggak mengandung kata "resi" (atau kata kunci lain yang dikonfigurasi), skip
    }

    const numberMatch = title.match(CONFIG.RESI_NUMBER_PATTERN);
    if (!numberMatch) {
      log('Ada kata "resi" di Title, tapi pola nomor resi tidak ketemu. Skip.');
      return null;
    }

    const noResi = numberMatch[0].toUpperCase();
    log('Cocok pola resi! Nomor resi dari Title:', noResi);

    const pages = pdfDoc.getPages();
    const pageIndex = Math.min(CONFIG.TARGET_PAGE_INDEX, pages.length - 1);
    const page = pages[pageIndex];
    log('Ukuran halaman PDF (pt):', page.getWidth(), 'x', page.getHeight());

    const qrDataUrl = await QRCodeLib.toDataURL(noResi, {
      width: 300,
      margin: 0,
      errorCorrectionLevel: 'M',
    });
    const qrPngBytes = base64ToUint8Array(qrDataUrl.split(',')[1]);
    const qrImage = await pdfDoc.embedPng(qrPngBytes);

    page.drawImage(qrImage, {
      x: CONFIG.QR_X,
      y: page.getHeight() - CONFIG.QR_OFFSET_FROM_TOP - CONFIG.QR_SIZE,
      width: CONFIG.QR_SIZE,
      height: CONFIG.QR_SIZE,
    });

    const modifiedBytes = await pdfDoc.save();
    return new Blob([modifiedBytes], { type: 'application/pdf' });
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  log('Resi QR Backup extension aktif (mode: cek Title metadata, tanpa fetch/XHR hook, tanpa pdf.js).');
})();
