/* GDO & Mio Capitale - motore delle simulazioni.
 * Unico file usato sia dall'app del Mac sia da quella del telefono (fase 5), cosi' i risultati coincidono.
 * Funzioni pure: ricevono numeri, restituiscono numeri. Nessun accesso alla pagina.
 *
 * Regole (le stesse spiegate nell'app):
 *  - l'utile dell'anno N, se distribuito, si incassa nell'anno N+2 (ritardo modificabile);
 *  - dividendo netto = utile x quota distribuita x tua quota x (1 - ritenuta);
 *  - la parte non distribuita resta in societa': fa crescere il patrimonio netto e il tuo capitale maturato;
 *  - "il giorno che smetto": tua quota x patrimonio netto + credito del finanziamento, tasse sulla parte che
 *    supera il costo delle quote.
 */
(function (radice, fabbrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabbrica();
  else radice.MotoreSim = fabbrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function dividendo(utile, quotaDistribuita, quota, ritenuta) {
    var lordo = Math.max(utile, 0) * quotaDistribuita * quota;
    return { distribuitoSocieta: Math.max(utile, 0) * quotaDistribuita, lordo: lordo, netto: lordo * (1 - ritenuta) };
  }

  /* Il capitale maturato pagato tutto in un anno o diviso in rate uguali (netti). */
  function rate(capitaleNetto, numeroRate, annoInizio) {
    var n = Math.max(1, Math.round(numeroRate));
    var r = [];
    for (var i = 0; i < n; i++) r.push({ anno: annoInizio + i, netto: capitaleNetto / n });
    return r;
  }

  /* Scenari di partenza calcolati dalla storia (medie degli ultimi anni). */
  function scenariPredefiniti(storia) {
    var b = {
      crescitaRicavi: storia.crescitaRicaviMedia, margineNetto: storia.margineNettoMedio,
      quotaDistribuita: storia.quotaDistribuitaMedia, crescitaStipendio: storia.crescitaStipendioMedia
    };
    return {
      pessimista: { nome: 'Pessimista', crescitaRicavi: b.crescitaRicavi - 0.02, margineNetto: b.margineNetto * 0.6,
                    quotaDistribuita: 0, crescitaStipendio: 0 },
      base: { nome: 'Base', crescitaRicavi: b.crescitaRicavi, margineNetto: b.margineNetto,
              quotaDistribuita: b.quotaDistribuita, crescitaStipendio: b.crescitaStipendio },
      ottimista: { nome: 'Ottimista', crescitaRicavi: b.crescitaRicavi + 0.02, margineNetto: b.margineNetto * 1.25,
                   quotaDistribuita: Math.max(b.quotaDistribuita, 0.6), crescitaStipendio: b.crescitaStipendio + 0.01 }
    };
  }

  /* Proiezione anno per anno.
   * base: { annoBase, ricavi, patrimonioNetto, residuoSocieta, utiliNoti: {anno: utile}, quota, ritenuta,
   *         stipendio, inps, f24, credito, costoQuote, ritardo }
   * scenario: { crescitaRicavi, margineNetto, quotaDistribuita, crescitaStipendio }
   * Restituisce una riga per ogni anno da annoBase+1 a annoFine. */
  function proietta(base, scenario, annoFine) {
    var ritardo = base.ritardo || 2;
    var utili = {};
    Object.keys(base.utiliNoti || {}).forEach(function (a) { utili[+a] = base.utiliNoti[a]; });
    var ricavi = base.ricavi, pn = base.patrimonioNetto, residuo = base.residuoSocieta;
    var stipendio = base.stipendio, inps = base.inps;
    var f24SuStipendio = base.stipendio ? (base.f24 / base.stipendio) : 0;
    var righe = [];
    for (var anno = base.annoBase + 1; anno <= annoFine; anno++) {
      ricavi = ricavi * (1 + scenario.crescitaRicavi);
      var utile = ricavi * scenario.margineNetto;
      utili[anno] = utile;
      // pagamento di quest'anno: l'utile di "ritardo" anni prima, per la quota distribuita
      var utilePagato = utili[anno - ritardo];
      var div = dividendo(utilePagato === undefined ? 0 : utilePagato, scenario.quotaDistribuita, base.quota, base.ritenuta);
      // patrimonio: entra l'utile dell'anno, esce quanto distribuito ai soci
      pn = pn + utile - div.distribuitoSocieta;
      residuo = Math.max(residuo + utile - div.distribuitoSocieta, 0);
      stipendio = stipendio * (1 + scenario.crescitaStipendio);
      inps = inps * (1 + scenario.crescitaStipendio);
      var f24 = stipendio * f24SuStipendio;
      var capitaleLordo = residuo * base.quota;
      var valoreQuota = Math.max(pn, 0) * base.quota;
      var tasse = Math.max(valoreQuota - (base.costoQuote || 0), 0) * base.ritenuta;
      righe.push({
        anno: anno, ricavi: ricavi, utile: utile, distribuito: div.distribuitoSocieta, patrimonioNetto: pn,
        residuoSocieta: residuo, dividendoNetto: div.netto, stipendio: stipendio, inps: inps, f24: f24,
        nettoInTasca: stipendio + div.netto - inps - f24,
        capitaleLordo: capitaleLordo, capitaleNetto: capitaleLordo * (1 - base.ritenuta),
        uscitaLordo: valoreQuota + (base.credito || 0), uscitaNetto: valoreQuota - tasse + (base.credito || 0)
      });
    }
    return righe;
  }

  /* "Se smetto nel 20XX": la riga di quell'anno della proiezione (o la situazione di oggi se l'anno e' gia' passato). */
  function seSmetto(base, scenario, annoUscita) {
    if (annoUscita <= base.annoBase) {
      var valore = Math.max(base.patrimonioNetto, 0) * base.quota;
      var tasse = Math.max(valore - (base.costoQuote || 0), 0) * base.ritenuta;
      return { anno: annoUscita, capitaleNetto: base.residuoSocieta * base.quota * (1 - base.ritenuta),
               uscitaLordo: valore + (base.credito || 0), uscitaNetto: valore - tasse + (base.credito || 0), dividendiIncassati: 0 };
    }
    var righe = proietta(base, scenario, annoUscita);
    var ultima = righe[righe.length - 1];
    var incassati = righe.reduce(function (s, r) { return s + r.dividendoNetto; }, 0);
    return { anno: annoUscita, capitaleNetto: ultima.capitaleNetto, uscitaLordo: ultima.uscitaLordo,
             uscitaNetto: ultima.uscitaNetto, dividendiIncassati: incassati };
  }

  return { dividendo: dividendo, rate: rate, scenariPredefiniti: scenariPredefiniti, proietta: proietta, seSmetto: seSmetto };
});
