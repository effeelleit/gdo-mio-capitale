/* GDO & Mio Capitale - cifratura del file per il telefono.
 * Lo stesso file e' usato dal Mac (per cifrare, nel browser) e dall'app del telefono (per decifrare).
 * Usa solo le funzioni crittografiche standard del browser (Web Crypto):
 *   - chiave ricavata dalla password con PBKDF2-SHA256 (sale casuale, 310.000 iterazioni);
 *   - cifratura e autenticazione con AES-GCM a 256 bit: password sbagliata o file manomesso vengono rifiutati.
 * Formato: "GDOTEL01" (8 byte) | sale (16) | iv (12) | dati cifrati.
 */
(function (radice, fabbrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabbrica();
  else radice.Cifratura = fabbrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MAGIC = 'GDOTEL01';
  var ITERAZIONI = 310000;

  function crypto_() {
    var c = (typeof globalThis !== 'undefined' && globalThis.crypto) || (typeof self !== 'undefined' && self.crypto);
    if ((!c || !c.subtle) && typeof require === 'function') {
      try { c = require('crypto').webcrypto; } catch (e) { /* non siamo in Node */ }
    }
    if (!c || !c.subtle) throw new Error('Questo browser non permette la cifratura (serve una pagina sicura, https).');
    return c;
  }

  function chiave(password, sale) {
    var c = crypto_();
    return c.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return c.subtle.deriveKey({ name: 'PBKDF2', salt: sale, iterations: ITERAZIONI, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  /* testo (stringa) -> Uint8Array cifrato */
  function cifra(testo, password) {
    if (!password) return Promise.reject(new Error('Serve una password.'));
    var c = crypto_();
    var sale = c.getRandomValues(new Uint8Array(16));
    var iv = c.getRandomValues(new Uint8Array(12));
    return chiave(password, sale).then(function (k) {
      return c.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(testo));
    }).then(function (dati) {
      var testa = new TextEncoder().encode(MAGIC);
      var out = new Uint8Array(testa.length + 16 + 12 + dati.byteLength);
      out.set(testa, 0); out.set(sale, 8); out.set(iv, 24); out.set(new Uint8Array(dati), 36);
      return out;
    });
  }

  function eNostro(bytes) {
    return bytes && bytes.length > 36 && new TextDecoder().decode(bytes.slice(0, 8)) === MAGIC;
  }

  /* Uint8Array cifrato -> stringa. Errore "PASSWORD" se la password e' sbagliata o il file e' danneggiato. */
  function decifra(bytes, password) {
    if (!eNostro(bytes)) return Promise.reject(new Error('FORMATO'));
    var sale = bytes.slice(8, 24), iv = bytes.slice(24, 36), dati = bytes.slice(36);
    return chiave(password || '', sale).then(function (k) {
      return crypto_().subtle.decrypt({ name: 'AES-GCM', iv: iv }, k, dati);
    }).then(function (chiaro) { return new TextDecoder().decode(chiaro); },
            function () { throw new Error('PASSWORD'); });
  }

  /* Per conservare il file cifrato nel telefono (localStorage accetta solo testo). */
  function inBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function daBase64(testo) {
    var s = atob(testo), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  return { cifra: cifra, decifra: decifra, eNostro: eNostro, inBase64: inBase64, daBase64: daBase64 };
});
