(function () {
  'use strict';

  // ================== KONFIGURASI (kalibrasi posisi QR di sini) ==================
  const CONFIG = {
    URL_PATTERN: /\/hydra\/v2\/stt\/resi\/([A-Za-z0-9]+)/,

    // Posisi & ukuran QR backup (satuan point PDF, 1pt = 1/72 inch)
    // Titik (0,0) = KIRI BAWAH halaman
    QR_X: 140,
    QR_Y: 550,
    QR_SIZE: 70,
    TARGET_PAGE_INDEX: 0,

    DEBUG: true,
  };
  // ===================================================================================

  const log = (...args) => CONFIG.DEBUG && console.log('[ResiQRBackup]', ...args);

  let lastResiNo = null;
  // Maping: original blob URL -> Promise<modified blob URL>
  const pendingModifications = new Map();

  // ---------- 1. Tangkap nomor resi dari JSON (untuk isi QR) ----------
  // Coba tangkap lewat fetch()...
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const request = args[0];
    const url = typeof request === 'string' ? request : request.url;
    const match = url && url.match(CONFIG.URL_PATTERN);
    const response = await originalFetch.apply(this, args);
    if (match && response.ok) {
      lastResiNo = match[1];
      log('Nomor resi terdeteksi (via fetch):', lastResiNo);
    }
    return response;
  };

  // ...DAN lewat XMLHttpRequest (kalau app pakai Axios/XHR, yang mana defaultnya XHR)
  const OriginalXHR = window.XMLHttpRequest;
  const originalXhrOpen = OriginalXHR.prototype.open;
  const originalXhrSend = OriginalXHR.prototype.send;

  OriginalXHR.prototype.open = function (method, url, ...rest) {
    this.__resiqr_url = url;
    return originalXhrOpen.call(this, method, url, ...rest);
  };

  OriginalXHR.prototype.send = function (...args) {
    const url = this.__resiqr_url;
    const match = url && String(url).match(CONFIG.URL_PATTERN);
    if (match) {
      this.addEventListener('load', function () {
        if (this.status >= 200 && this.status < 300) {
          lastResiNo = match[1];
          log('Nomor resi terdeteksi (via XHR):', lastResiNo);
        }
      });
    }
    return originalXhrSend.apply(this, args);
  };

  // ---------- 2. Hook createObjectURL: deteksi blob PDF, mulai proses modifikasi di background ----------
  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (blob) {
    const originalUrl = originalCreateObjectURL(blob);

    // LOG SEMUA pemanggilan createObjectURL, apapun tipenya, buat diagnosis
    if (blob instanceof Blob) {
      log('createObjectURL dipanggil. type:', JSON.stringify(blob.type), 'size:', blob.size, 'url:', originalUrl, 'lastResiNo:', lastResiNo);
    }

    // Perlonggar filter: terima juga type kosong/octet-stream, asal ukurannya masuk akal buat PDF
    const looksLikePdfBlob =
      blob instanceof Blob &&
      (blob.type === 'application/pdf' || blob.type === '' || blob.type === 'application/octet-stream') &&
      blob.size > 500;

    if (looksLikePdfBlob && lastResiNo) {
      log('Blob PDF terdeteksi, mulai proses suntik QR di background...', originalUrl);
      const noResi = lastResiNo;
      const modPromise = injectQrIntoPdfBlob(blob, noResi)
        .then((modifiedBlob) => {
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

  // ---------- 3. Hook window.open: begitu tab baru dibuka dgn URL yg sedang diproses, redirect ke versi ber-QR ----------
  const originalWindowOpen = window.open.bind(window);
  window.open = function (url, ...rest) {
    log('window.open dipanggil dengan url:', url, 'ada di pendingModifications?', pendingModifications.has(url));
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
      log('Klik pada <a href="blob:...">terdeteksi:', url, 'ada di pendingModifications?', pendingModifications.has(url));

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

  // ---------- Helper: suntik QR ke bytes PDF pakai pdf-lib ----------
  async function injectQrIntoPdfBlob(blob, noResi) {
    const pdfBytes = new Uint8Array(await blob.arrayBuffer());
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const qrDataUrl = await QRCodeLib.toDataURL(noResi, {
      width: 300,
      margin: 0,
      errorCorrectionLevel: 'M',
    });
    const qrPngBytes = base64ToUint8Array(qrDataUrl.split(',')[1]);
    const qrImage = await pdfDoc.embedPng(qrPngBytes);

    const pages = pdfDoc.getPages();
    const pageIndex = Math.min(CONFIG.TARGET_PAGE_INDEX, pages.length - 1);
    const page = pages[pageIndex];
    log('Ukuran halaman PDF (pt):', page.getWidth(), 'x', page.getHeight());

    page.drawImage(qrImage, {
      x: CONFIG.QR_X,
      y: CONFIG.QR_Y,
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

  log('Resi QR Backup extension aktif (mode: blob PDF interception).');
})();
