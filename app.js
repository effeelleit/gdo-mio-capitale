/* GDO & Mio Capitale - app del telefono.
 * Contenitore vuoto: i dati arrivano solo dal file cifrato esportato dal Mac.
 * Nel telefono il file resta cifrato (localStorage); i dati in chiaro esistono solo in memoria
 * finche' l'app e' sbloccata, e spariscono con il blocco automatico.
 */
(function () {
  'use strict';
  var K_DATI = 'gdo:dati', K_PREF = 'gdo:pref';
  var VERSIONE_APP = '16/10/2026 · ddb1';
  var dati = null;            // dati decifrati (solo in memoria)
  var ultimoUso = Date.now();
  var main = document.getElementById('contenuto');
  var nav = document.getElementById('nav');
  var btnBlocca = document.getElementById('blocca');

  // ------------------------------------------------------------ preferenze di questo telefono
  function pref() { try { return JSON.parse(localStorage.getItem(K_PREF) || '{}'); } catch (e) { return {}; } }
  function salvaPref(p) { try { localStorage.setItem(K_PREF, JSON.stringify(p)); } catch (e) {} }
  function applicaPref() {
    var p = pref(), html = document.documentElement;
    html.setAttribute('data-colore', p.colore || (dati && dati.colore) || 'A');
    html.setAttribute('data-tema-scelta', p.tema || (dati && dati.tema) || 'automatico');
    window.__applicaTema();
  }
  function minutiBlocco() { var p = pref(); return p.blocco === undefined ? 5 : Number(p.blocco); }

  // ------------------------------------------------------------ file cifrato
  function salvato() { try { return localStorage.getItem(K_DATI); } catch (e) { return null; } }
  function leggiFile(file) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(new Uint8Array(r.result)); };
      r.onerror = function () { ko(new Error('Il file non si riesce a leggere.')); };
      r.readAsArrayBuffer(file);
    });
  }
  function apri(bytes, password) {
    return Cifratura.decifra(bytes, password).then(function (testo) {
      var d = JSON.parse(testo);
      if (!d || d.app !== 'GDO & Mio Capitale' || !d.pagine) throw new Error('FORMATO');
      return d;
    });
  }
  function messaggioErrore(e) {
    if (e.message === 'PASSWORD') return 'Password sbagliata (oppure il file è danneggiato).';
    if (e.message === 'FORMATO') return 'Questo non è un file dei dati di GDO & Mio Capitale (.gdotel).';
    return e.message;
  }

  // ------------------------------------------------------------ schermate di accesso
  function mostraModello(id) {
    main.innerHTML = '';
    main.appendChild(document.getElementById(id).content.cloneNode(true));
    // versione dell'app in basso, discreta: si vede subito se l'aggiornamento e' arrivato
    var v = document.createElement('p');
    v.className = 'versione-accesso';
    v.textContent = 'Versione dell\'app: ' + VERSIONE_APP;
    main.appendChild(v);
    nav.hidden = true; btnBlocca.hidden = true;
    document.getElementById('aggiornato').textContent = '';
  }
  function benvenuto() {
    mostraModello('t-benvenuto');
    var err = document.getElementById('errore');
    document.getElementById('apri').addEventListener('click', function () {
      var f = document.getElementById('file').files[0], pw = document.getElementById('pw').value;
      err.textContent = '';
      if (!f) { err.textContent = 'Scegli il file dei dati.'; return; }
      if (!pw) { err.textContent = 'Scrivi la password.'; return; }
      this.disabled = true; this.textContent = 'Apro…';
      var btn = this;
      leggiFile(f).then(function (bytes) {
        return apri(bytes, pw).then(function (d) {
          try { localStorage.setItem(K_DATI, Cifratura.inBase64(bytes)); }
          catch (e) { throw new Error('Spazio insufficiente sul telefono per conservare i dati.'); }
          entra(d);
        });
      }).catch(function (e) { err.textContent = messaggioErrore(e); btn.disabled = false; btn.textContent = 'Apri i dati'; });
    });
  }
  function sblocco() {
    dati = null;
    mostraModello('t-sblocco');
    document.getElementById('sblocco-info').textContent = 'I tuoi dati sono su questo telefono, cifrati. Scrivi la password per vederli.';
    var err = document.getElementById('errore'), pw = document.getElementById('pw');
    function prova() {
      err.textContent = '';
      var btn = document.getElementById('sblocca'); btn.disabled = true; btn.textContent = 'Sblocco…';
      apri(Cifratura.daBase64(salvato()), pw.value).then(entra).catch(function (e) {
        err.textContent = messaggioErrore(e); btn.disabled = false; btn.textContent = 'Sblocca'; pw.select();
      });
    }
    document.getElementById('sblocca').addEventListener('click', prova);
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') prova(); });
    document.getElementById('cancella').addEventListener('click', cancellaTutto);
  }
  function cancellaTutto() {
    if (!confirm('Cancellare i dati da questo telefono? Potrai ricaricarli con un nuovo file dal Mac.')) return;
    try { localStorage.removeItem(K_DATI); } catch (e) {}
    dati = null; location.hash = ''; benvenuto();
  }
  function entra(d) {
    dati = d; ultimoUso = Date.now();
    applicaPref();
    nav.hidden = false; btnBlocca.hidden = false;
    var c = new Date(d.creato_il);
    document.getElementById('aggiornato').textContent = 'Dati aggiornati al ' + c.toLocaleDateString('it-IT') + ' ' +
      c.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    vai();
  }
  function blocca() { if (dati) { dati = null; sblocco(); } }

  // ------------------------------------------------------------ navigazione
  function rotta() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    var pre = dati.predefinite || {};
    if (!h || h === 'anno') return pre.anno ? 'anno/' + pre.anno : 'vuoto';
    if (h === 'salute') return pre.salute ? rottaSalute(pre.salute) : 'vuoto';
    if (/^salute\/\d+$/.test(h)) return rottaSalute(h.split('/')[1]);
    if (h === 'negozi') return pre.negozi ? 'negozi/' + pre.negozi : 'vuoto';
    return h;
  }
  function rottaSalute(sid) {
    var pre = dati.predefinite || {};
    return pre['salute/' + sid] ? 'salute/' + sid + '/' + pre['salute/' + sid] : 'salute/' + sid;
  }

  // Tabelle: si adattano da sole alla larghezza del telefono (qualunque modello, anche girato).
  // 1) se non ci stanno, testo piu' piccolo; 2) se ancora non ci stanno, ogni riga diventa una scheda.
  function adattaTabelle() {
    main.querySelectorAll('table').forEach(function (t) {
      t.classList.remove('compatta', 'impilata');
      var box = t.parentElement;
      if (t.scrollWidth <= box.clientWidth + 1) return;
      t.classList.add('compatta');
      if (t.scrollWidth <= box.clientWidth + 1) return;
      var tit = Array.prototype.map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
      t.querySelectorAll('tbody tr').forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) { if (tit[i]) td.setAttribute('data-etichetta', tit[i]); });
      });
      t.classList.add('impilata');
    });
  }
  var timerAdatta;
  function adattaPiuTardi() {
    clearTimeout(timerAdatta);
    timerAdatta = setTimeout(function () { if (dati) adattaTabelle(); }, 150);
  }
  window.addEventListener('resize', adattaPiuTardi);
  // anche le tabelle create dopo (es. risultati delle simulazioni)
  new MutationObserver(adattaPiuTardi).observe(main, { childList: true, subtree: true });
  function vai() {
    if (!dati) return;
    var r = rotta(), html, ancora = null;
    if (r.indexOf('glossario/') === 0) { ancora = 'g-' + r.split('/')[1]; r = 'glossario'; }
    if (r === 'altro') html = paginaAltro();
    else if (r === 'impostazioni') html = paginaImpostazioni();
    else if (r === 'vuoto') html = '<h1>Nessun dato</h1><div class="card"><p>Questa sezione non ha ancora dati: inseriscili sul Mac e riesporta.</p></div>';
    else html = dati.pagine[r] || '<h1>Pagina non trovata</h1><div class="card"><p>Torna a <a href="#anno">Il mio anno</a>.</p></div>';
    main.innerHTML = html;
    setTimeout(adattaTabelle, 0);
    eseguiScript(main);
    if (r === 'impostazioni') collegaImpostazioni();
    var tab = r.split('/')[0];
    if (tab === 'pagelle' || tab.indexOf('pv-') === 0) tab = 'negozi';
    if (['scadenze', 'avvisi', 'glossario', 'impostazioni', 'guida'].indexOf(tab) >= 0) tab = 'altro';
    nav.querySelectorAll('a').forEach(function (a) { a.classList.toggle('attivo', a.getAttribute('data-tab') === tab); });
    // l'anno scelto visibile nella fila degli anni
    main.querySelectorAll('.anni-tel .chip.sel').forEach(function (c) { c.scrollIntoView({ block: 'nearest', inline: 'center' }); });
    if (ancora && document.getElementById(ancora)) document.getElementById(ancora).scrollIntoView();
    else window.scrollTo(0, 0);
  }
  // Le pagine (es. Simulazioni) contengono script: inseriti con innerHTML non partono, quindi li ricreo.
  function eseguiScript(radice) {
    radice.querySelectorAll('script').forEach(function (vecchio) {
      var nuovo = document.createElement('script');
      nuovo.textContent = vecchio.textContent;
      vecchio.parentNode.replaceChild(nuovo, vecchio);
    });
  }
  window.addEventListener('hashchange', function () { if (dati) vai(); });

  // ------------------------------------------------------------ pagine locali: Altro, Impostazioni
  function paginaAltro() {
    var voci = [['#scadenze', 'Scadenze', 'INPS, F24, bilanci e possibili dividendi'],
                ['#avvisi', 'Tutti gli avvisi', 'Dati da completare e segnali'],
                ['#pagelle', 'Pagelle dei negozi', 'Il confronto su tutti gli anni'],
                ['#guida', 'Guida', 'Come si legge ogni pagina, con esempi'],
                ['#glossario', 'Glossario', 'I termini spiegati in parole semplici'],
                ['#impostazioni', 'Impostazioni', 'Colore, tema, blocco, nuovo file dei dati']];
    return '<h1>Altro</h1>' + voci.map(function (v) {
      return '<a class="card voce-altro" href="' + v[0] + '"><b>' + v[1] + '</b><span class="muto piccolo">' + v[2] + '</span></a>';
    }).join('');
  }
  function paginaImpostazioni() {
    var p = pref(), colore = p.colore || dati.colore || 'A', tema = p.tema || dati.tema || 'automatico', bl = minutiBlocco();
    var colori = [['A', 'Blu istituzionale'], ['B', 'Verde salvadanaio'], ['C', 'Ardesia e oro'], ['D', 'Indaco moderno']];
    var radio = function (nome, val, etich, sel) {
      return '<label class="opzione"><input type="radio" name="' + nome + '" value="' + val + '"' + (sel ? ' checked' : '') + '> ' + etich + '</label>';
    };
    return '<h1>Impostazioni</h1>' +
      '<div class="card"><div class="card-t">Colore</div><div class="opzioni">' +
      colori.map(function (c) { return radio('colore', c[0], c[0] + ' · ' + c[1], colore === c[0]); }).join('') + '</div>' +
      '<div class="card-t" style="margin-top:14px">Tema</div><div class="opzioni">' +
      radio('tema', 'chiaro', 'Chiaro', tema === 'chiaro') + radio('tema', 'scuro', 'Scuro', tema === 'scuro') +
      radio('tema', 'automatico', 'Automatico', tema === 'automatico') + '</div></div>' +
      '<div class="card"><div class="card-t">Blocco automatico</div><p class="piccolo">Dopo quanti minuti senza uso l\'app richiede la password.</p><div class="opzioni">' +
      [1, 5, 15, 0].map(function (m) { return radio('blocco', m, m ? m + ' min' : 'Mai', bl === m); }).join('') + '</div></div>' +
      '<div class="card"><div class="card-t">Carica un nuovo file dei dati</div>' +
      '<p class="piccolo">Dopo aver esportato di nuovo dal Mac. Sostituisce i dati attuali.</p>' +
      '<input id="file2" type="file"><label for="pw2" style="margin-top:10px">Password del nuovo file</label><input id="pw2" type="password">' +
      '<div class="azioni"><button type="button" id="carica2">Carica</button></div><div id="errore2" class="errore-testo piccolo" role="alert"></div></div>' +
      '<div class="card"><div class="card-t">Questo telefono</div>' +
      '<p class="piccolo">Dati esportati dal Mac il ' + new Date(dati.creato_il).toLocaleString('it-IT') + '.</p><p class="piccolo"><b>Versione dell\'app: ' + VERSIONE_APP + '</b> (si aggiorna da sola quando la apri con internet).</p>' +
      '<button type="button" id="aggiorna" class="secondario">Cerca aggiornamenti dell\'app</button><p class="piccolo muto" id="stato-agg" style="margin-top:6px"></p>' +
      '<button type="button" class="secondario" id="cancella2">Cancella i dati da questo telefono</button></div>';
  }
  function collegaImpostazioni() {
    main.querySelectorAll('input[type=radio]').forEach(function (r) {
      r.addEventListener('change', function () {
        var p = pref();
        p[r.name] = r.name === 'blocco' ? Number(r.value) : r.value;
        salvaPref(p); applicaPref();
      });
    });
    document.getElementById('cancella2').addEventListener('click', cancellaTutto);
    document.getElementById('aggiorna').addEventListener('click', cercaAggiornamento);
    document.getElementById('carica2').addEventListener('click', function () {
      var f = document.getElementById('file2').files[0], pw = document.getElementById('pw2').value, err = document.getElementById('errore2');
      err.textContent = '';
      if (!f || !pw) { err.textContent = 'Scegli il file e scrivi la password.'; return; }
      leggiFile(f).then(function (bytes) {
        return apri(bytes, pw).then(function (d) {
          localStorage.setItem(K_DATI, Cifratura.inBase64(bytes));
          location.hash = '#anno'; entra(d);
        });
      }).catch(function (e) { err.textContent = messaggioErrore(e); });
    });
  }

  // ------------------------------------------------------------ aggiornamento dell'app (il contenitore, non i dati)
  // Scarica sw.js senza cache e confronta la versione con quella in uso. Se e' cambiata svuota la cache dell'app
  // (NON i dati: quelli stanno nella memoria del browser, a parte) e ricarica la pagina con la versione nuova.
  function cercaAggiornamento() {
    var stato = document.getElementById('stato-agg');
    stato.textContent = 'Controllo in corso…';
    fetch('sw.js?c=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('rete');
      return r.text();
    }).then(function (testo) {
      var m = testo.match(/gdo-mio-capitale-([0-9a-f]+)/);
      var nuova = m ? m[1] : '';
      return caches.keys().then(function (chiavi) {
        // la versione che sta girando e' scritta in VERSIONE_APP («data · prime 4 cifre del codice»)
        if (nuova && nuova.indexOf(VERSIONE_APP.split('· ')[1] || '#') === 0) {
          stato.textContent = 'L\'app è già aggiornata (' + VERSIONE_APP + ').';
          return;
        }
        stato.textContent = 'Trovata una versione nuova: aggiornamento in corso…';
        var togli = navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (g) { return g.unregister(); }));
        }) : Promise.resolve();
        return togli.then(function () {
          return Promise.all(chiavi.filter(function (k) { return k.indexOf('gdo-mio-capitale-') === 0; })
            .map(function (k) { return caches.delete(k); }));
        }).then(function () { location.reload(); });
      });
    }).catch(function () {
      stato.textContent = 'Non riesco a collegarmi a internet: riprova quando sei connesso.';
    });
  }

  // ------------------------------------------------------------ blocco automatico
  ['click', 'touchstart', 'keydown', 'scroll'].forEach(function (ev) {
    document.addEventListener(ev, function () { ultimoUso = Date.now(); }, { passive: true });
  });
  function controllaBlocco() {
    var m = minutiBlocco();
    if (dati && m > 0 && Date.now() - ultimoUso > m * 60000) blocca();
  }
  setInterval(controllaBlocco, 15000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) controllaBlocco(); });
  btnBlocca.addEventListener('click', blocca);

  // ------------------------------------------------------------ avvio
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    // updateViaCache 'none': il browser ricontrolla sw.js ogni volta, senza usare la sua cache
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) { reg.update(); }).catch(function () {});
  }
  applicaPref();
  if (salvato()) sblocco(); else benvenuto();
})();
