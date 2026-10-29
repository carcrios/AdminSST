/* ============================================================
   common.js — Utilidades compartidas del Portal SSTA
   Usado por: permiso-trabajo-alturas.html y permiso-trabajo-caliente.html
   ============================================================ */

/**
 * esc: escapa texto antes de insertarlo con innerHTML. Los datos que
 * vienen de la hoja de cálculo (nombres, sitios, responsables, cédulas)
 * los escribe cualquier persona con acceso al formulario — sin escapar,
 * un valor como <img src=x onerror=...> se ejecutaría en el navegador
 * de quien lo vea después (dashboard, listas de permisos abiertos, etc).
 */
function esc(v){
  return String(v==null?'':v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/**
 * fetchWithRetry: como fetch(), pero reintenta automáticamente si hay
 * un fallo de red (típico en zonas de planta con señal débil), con
 * espera creciente entre intentos.
 */
/* ── v120: los módulos por ?modulo= y no por /módulo ──
   Con algunas cuentas, Google pide iniciar sesión en «…/exec/sgsst» aunque «…/exec» esté abierta
   para cualquier usuario (caso real). El servidor único ya entiende «?modulo=sgsst», así que aquí se
   reescribe toda llamada a «…/exec/<módulo>» (de cualquier servidor, también los de los clientes desde
   la consola). Si viaja como consulta por POST, el módulo va también dentro de la consulta. */
(function () {
  if (typeof window === 'undefined' || !window.fetch) return;
  const original = window.fetch.bind(window);
  // Cualquier servidor «…/exec/<módulo>» (Google, y la demo, que así prueba este mismo camino).
  const RE = /^(https?:\/\/[^?#]+\/exec)\/([a-z]+)\/?(\?.*)?$/;
  window.fetch = function (entrada, opciones) {
    const url = typeof entrada === 'string' ? entrada : '';
    const m = RE.exec(url);
    if (!m) return original(entrada, opciones);
    const nueva = m[1] + '?modulo=' + m[2] + (m[3] ? '&' + m[3].slice(1) : '');
    if (opciones && typeof opciones.body === 'string' && opciones.body.indexOf('__consulta') !== -1) {
      try { const b = JSON.parse(opciones.body); if (b && b.__consulta && !b.__consulta.modulo) { b.__consulta.modulo = m[2]; opciones = Object.assign({}, opciones, { body: JSON.stringify(b) }); } } catch (e) {}
    }
    return original(nueva, opciones);
  };
})();

/* ── v110: la clave del portal y la sesión no viajan en la dirección ──
   Las consultas al servidor (GET con token= o sesion=) se mandan por POST con
   { __consulta: {…} }: la dirección queda limpia y la clave no queda en los
   registros. Solo si el servidor único de la empresa lo anuncia en su raíz
   («consultaPost»); con un servidor sin actualizar sigue el GET de siempre. */
(function () {
  if (typeof window === 'undefined' || !window.fetch || typeof EMPRESA === 'undefined' || !EMPRESA.servidor) return;
  const base = String(EMPRESA.servidor).replace(/\/+$/, '');
  const LS = 'ssta-consulta-post|' + base, original = window.fetch.bind(window);
  let modo = null, pendiente = null;
  try { const g = JSON.parse(localStorage.getItem(LS) || 'null'); if (g && (g.m === 'si' || Date.now() - g.t < 6 * 3600000)) modo = g.m; } catch (e) {}
  function averiguar() {
    if (modo) return Promise.resolve(modo);
    if (!pendiente) pendiente = original(base).then((r) => r.json()).then((j) => {
      modo = j && Array.isArray(j.capacidades) && j.capacidades.indexOf('consultaPost') !== -1 ? 'si' : 'no';
      try { localStorage.setItem(LS, JSON.stringify({ m: modo, t: Date.now() })); } catch (e) {}
      return modo;
    }).catch(() => { pendiente = null; return 'no'; });   // sin señal: se vuelve a averiguar después
    return pendiente;
  }
  // Sesion se define más abajo en este archivo; cuando se hace una petición ya existe.
  function sesionActual() { try { return (typeof Sesion !== 'undefined' && Sesion.token()) || ''; } catch (e) { return ''; } }
  window.ConsultaPost = { averiguar, modo: () => modo };
  window.fetch = async function (entrada, opciones) {
    const url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
    const metodo = String((opciones && opciones.method) || (entrada && typeof entrada !== 'string' && entrada.method) || 'GET').toUpperCase();
    // v112: los permisos, el ATS, las charlas, el EPP y el personal piden usuario también en el
    // servidor: todo envío al servidor del portal lleva la sesión de quien entró (si no la trae ya).
    if (metodo === 'POST' && url.indexOf(base + '/') === 0 && opciones && typeof opciones.body === 'string') {
      const ses = sesionActual();
      if (ses) { try { const b = JSON.parse(opciones.body); if (b && typeof b === 'object' && !Array.isArray(b) && !b.sesion && !b.__consulta) { b.sesion = ses; opciones = Object.assign({}, opciones, { body: JSON.stringify(b) }); } } catch (e) {} }
    }
    if (metodo !== 'GET' || url.indexOf(base + '/') !== 0 || !/[?&](token|sesion)=/.test(url)) return original(entrada, opciones);
    if ((await averiguar()) !== 'si') return original(entrada, opciones);
    const u = new URL(url), consulta = {};
    u.searchParams.forEach((v, k) => { consulta[k] = v; });
    if (!consulta.sesion) { const ses = sesionActual(); if (ses) consulta.sesion = ses; }
    u.search = '';
    return original(u.toString(), Object.assign({}, opciones, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ __consulta: consulta }) }));
  };
})();

async function fetchWithRetry(url, options, retries = 2, backoffMs = 800) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Si un backend rechaza la clave del portal, se pide aquí, en un solo
      // lugar, para todas las páginas (sin tocar cómo lee cada una la respuesta).
      if (String(url).indexOf('script.google') !== -1 && res && res.clone) {
        res.clone().json().then((j) => { if (ClavePortal.esErrorDeClave(j)) ClavePortal.pedir(); }).catch(() => {});
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/* ================= CLAVE DEL PORTAL =================
   El token de config.js es público (GitHub): cualquiera con él podía leer
   nombres, cédulas y firmas. Ahora cada backend puede exigir una CLAVE que
   no está en GitHub: se escribe una vez en cada celular y queda guardada
   en ese equipo. Mientras un equipo no tenga clave, se sigue usando el
   token de config.js (los backends que aún no tengan clave lo aceptan). */
/* v115: la consola del administrador (admin.html, asesor.html) guarda su sesión y su
   clave aparte (ssta-admin-…): en el mismo equipo no se mezclan con las de un cliente. */
const Consola = {
  activa() { return typeof EMPRESA !== 'undefined' && !!EMPRESA.consola; },
  clave(k) { return this.activa() ? k.replace(/^ssta-/, 'ssta-admin-') : k; },
  /** ¿En este equipo entró el administrador general? (ve los detalles técnicos). */
  esEquipoAdmin() {
    try { const s = JSON.parse(localStorage.getItem('ssta-admin-sesion') || 'null'); return !!(s && s.token && s.exp > Date.now() && s.yo && s.yo.rol === 'admin'); } catch (e) { return false; }
  }
};
const ClavePortal = {
  get KEY() { return Consola.clave('ssta-clave-portal'); },
  get() { try { return localStorage.getItem(this.KEY) || ''; } catch (e) { return ''; } },
  tiene() { return !!this.get(); },
  guardar(v) {
    try { if (v) localStorage.setItem(this.KEY, v); else localStorage.removeItem(this.KEY); } catch (e) { /* modo privado */ }
    this.aplicar();
  },
  aplicar() {
    if (typeof PORTAL_CONFIG === 'undefined') return;
    if (PORTAL_CONFIG._tokenOriginal === undefined) PORTAL_CONFIG._tokenOriginal = PORTAL_CONFIG.API_TOKEN;
    PORTAL_CONFIG.API_TOKEN = this.get() || PORTAL_CONFIG._tokenOriginal;
  },
  esErrorDeClave(j) {
    return !!(j && j.ok === false && (j.codigoError === 'CLAVE' || /token inv[aá]lido/i.test(String(j.error || ''))));
  },
  _abierto: false,
  pedir(motivo) {
    if (this._abierto || typeof document === 'undefined' || !document.body) return;
    this._abierto = true;
    const tenia = this.tiene();
    const fondo = document.createElement('div');
    fondo.className = 'clave-fondo';
    fondo.innerHTML =
      '<div class="clave-caja" role="dialog" aria-modal="true" aria-labelledby="claveTitulo">' +
      '<h3 id="claveTitulo">🔑 Clave del portal</h3>' +
      '<p>' + esc(motivo || (tenia
        ? 'El servidor no aceptó la clave guardada en este equipo. Escribe la clave vigente (la da el área SSTA).'
        : 'Para ver y guardar datos del personal, este equipo necesita la clave del portal. Se escribe una sola vez: queda guardada en este celular.')) + '</p>' +
      '<input type="password" id="claveInput" autocomplete="current-password" placeholder="Clave del portal">' +
      '<label class="clave-ver"><input type="checkbox" id="claveVer"> Mostrar</label>' +
      '<div class="clave-acc"><button type="button" class="btn-main" id="claveGuardar">Guardar clave</button>' +
      '<button type="button" class="btn-secondary" id="claveCancelar">Ahora no</button></div>' +
      (tenia ? '<button type="button" class="clave-quitar" id="claveQuitar">Quitar la clave de este equipo</button>' : '') +
      '</div>';
    document.body.appendChild(fondo);
    const inp = fondo.querySelector('#claveInput');
    const cerrar = () => { fondo.remove(); this._abierto = false; };
    fondo.querySelector('#claveVer').addEventListener('change', (e) => { inp.type = e.target.checked ? 'text' : 'password'; });
    fondo.querySelector('#claveCancelar').addEventListener('click', cerrar);
    const q = fondo.querySelector('#claveQuitar');
    if (q) q.addEventListener('click', () => { this.guardar(''); cerrar(); ClavePortal._despues(); });
    const guardarla = () => {
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      this.guardar(v); cerrar(); ClavePortal._despues();
    };
    fondo.querySelector('#claveGuardar').addEventListener('click', guardarla);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') guardarla(); });
    setTimeout(() => inp.focus(), 50);
  },
  /* Después de cambiar la clave: lo pendiente se reintenta con la nueva. Las
     páginas sin formulario (inicio, tablero) se recargan para volver a
     consultar; en un formulario NO se recarga, para no perder lo escrito. */
  _despues() {
    try { if (typeof Outbox !== 'undefined') Outbox.flush(); } catch (e) {}
    const hayFormulario = document.querySelector('#app, #atsApp, form');
    if (!hayFormulario) location.reload();
    else alert('Clave guardada en este equipo. Vuelve a intentar lo que estabas haciendo (buscar, guardar o abrir).');
  }
};
ClavePortal.aplicar();

/* ================= JORNADA: ATS → PERMISOS → CHARLA → ANEXO =================
   Antes eran cuatro formatos que se llenaban por separado con los MISMOS
   datos (trabajo, sitio, fechas, personal). Ahora, al guardar el ATS, se
   inicia una "jornada": cada paso se abre con lo del ATS ya puesto y, al
   guardarse, queda marcado. Una barra arriba muestra el avance y lleva al
   siguiente paso. Vive en este equipo (localStorage) hasta que se termina o
   pasan 20 horas. */
const Jornada = {
  KEY: 'ssta-jornada',
  FLAG: 'ssta-jornada-en-curso',
  VIGENCIA_MS: 20 * 3600 * 1000,
  _leer() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  _escribir(j) { try { localStorage.setItem(this.KEY, JSON.stringify(j)); } catch (e) {} window.dispatchEvent(new CustomEvent('jornada-cambio')); },
  /** datos: { atsCode, trabajo, sitio, desde, hasta, horaDesde, horaHasta, responsable, personas:[{nombre,cc,cargo}], permisosReq:['alturas',…] } */
  iniciar(datos) {
    const prev = this._leer();
    const mismo = prev && prev.atsCode === datos.atsCode;
    const j = Object.assign({}, datos, { t: Date.now(), hechos: mismo ? (prev.hechos || {}) : {} });
    this._escribir(j);
    try { sessionStorage.setItem(this.FLAG, '1'); } catch (e) {}
    return j;
  },
  actual() {
    const j = this._leer();
    if (!j || !j.atsCode || Date.now() - (j.t || 0) > this.VIGENCIA_MS) return null;
    return j;
  },
  terminar() { try { localStorage.removeItem(this.KEY); sessionStorage.removeItem(this.FLAG); } catch (e) {} window.dispatchEvent(new CustomEvent('jornada-cambio')); },
  /** ¿Esta página se abrió como parte de la jornada? (enlace con ?jornada=1 o la misma pestaña). */
  enJornada() {
    if (!this.actual()) return false;
    if (/[?&]jornada=1\b/.test(location.search)) { try { sessionStorage.setItem(this.FLAG, '1'); } catch (e) {} return true; }
    try { return sessionStorage.getItem(this.FLAG) === '1'; } catch (e) { return false; }
  },
  marcar(paso, info) {
    const j = this.actual();
    if (!j) return;
    j.hechos = j.hechos || {};
    j.hechos[paso] = Object.assign({ t: Date.now() }, info || {});
    this._escribir(j);
    if (!(info && info.omitido)) setTimeout(() => this._avisoPaso(paso), 600);
  },
  /** Lo llama el permiso al guardarse: solo cuenta si es del ATS de la jornada. */
  marcarPermiso(tipo, code, atsCode, pendiente) {
    const j = this.actual();
    if (!j || !tipo || (atsCode && atsCode !== j.atsCode) || !atsCode) return;
    this.marcar('permiso:' + tipo, { code, pendiente: !!pendiente });
  },
  pasos(j) {
    j = j || this.actual();
    if (!j) return [];
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const h = j.hechos || {};
    const out = [{ id: 'ats', titulo: 'ATS', icono: '🧭', hecho: { code: j.atsCode } }];
    (j.permisosReq || []).forEach((k) => {
      if (!B[k]) return;
      out.push({ id: 'permiso:' + k, titulo: B[k].nombre.replace(/^Trabajo (en |)/i, ''), icono: B[k].icono || '📝', hecho: h['permiso:' + k] || null });
    });
    out.push({ id: 'charla', titulo: 'Charla', icono: '🗣️', hecho: h.charla || null });
    out.push({ id: 'anexo', titulo: 'Anexo', icono: '👷', hecho: h.anexo || null });
    return out;
  },
  siguiente(j) { return this.pasos(j).find((p) => !p.hecho) || null; },
  /** Qué paso es esta página (si es uno de la jornada). */
  pasoDeEstaPagina() {
    const aqui = (location.pathname.split('/').pop() || '');
    if (aqui === 'asistencia.html') return 'charla';
    if (aqui === 'personal-autorizado.html') return 'anexo';
    if (aqui === 'ats.html') return 'ats';
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const k = Object.keys(B).find((x) => B[x].archivo === aqui);
    return k ? 'permiso:' + k : null;
  },
  /** Va al paso. A los permisos se les deja el prellenado del ATS (como el botón del ATS). */
  abrir(id) {
    const j = this.actual();
    if (!j) return;
    try { sessionStorage.setItem(this.FLAG, '1'); } catch (e) {}
    const B = PORTAL_CONFIG.BACKENDS;
    if (id === 'ats') { location.href = 'ats.html?code=' + encodeURIComponent(j.atsCode) + '&jornada=1'; return; }
    if (id === 'charla') { location.href = 'asistencia.html?jornada=1'; return; }
    if (id === 'anexo') { location.href = 'personal-autorizado.html?jornada=1'; return; }
    if (id.indexOf('permiso:') === 0) {
      const k = id.slice(8);
      if (!B[k]) return;
      const prefill = { t: Date.now(), tipo: k, atsCode: j.atsCode, trabajo: j.trabajo || '', sitio: j.sitio || '',
        desde: j.desde || '', hasta: j.hasta || j.desde || '', horaDesde: j.horaDesde || '', horaHasta: j.horaHasta || '',
        responsable: j.responsable || '', personas: j.personas || [] };
      try { localStorage.setItem('ssta-prefill-permiso', JSON.stringify(prefill)); } catch (e) { alert('No se pudo preparar el permiso (memoria del equipo llena).'); return; }
      location.href = B[k].archivo + '?desdeAts=1&jornada=1';
    }
  },
  omitir(id) { this.marcar(id, { omitido: true }); },
  /** Ir a un paso. Si el paso es esta misma página (charla o anexo), no se recarga: la página lo abre. */
  ir(id) {
    if (id === this.pasoDeEstaPagina() && (id === 'charla' || id === 'anexo')) { window.dispatchEvent(new CustomEvent('jornada-ir', { detail: id })); return; }
    this.abrir(id);
  },
  /** Aviso abajo al terminar un paso, con botón al siguiente (la barra queda arriba, fuera de vista). */
  _avisoPaso(paso) {
    if (typeof document === 'undefined' || !this.enJornada()) return;
    const j = this.actual(); if (!j) return;
    const sig = this.siguiente(j);
    const hecho = (this.pasos(j).find((p) => p.id === paso) || {}).titulo || 'Paso';
    const prev = document.getElementById('jornadaAviso'); if (prev) prev.remove();
    const el = document.createElement('div');
    el.id = 'jornadaAviso';
    el.className = 'jornada-aviso';
    el.innerHTML = '<span>✓ ' + esc(hecho) + ' listo.' + (sig ? ' Siguiente: <b>' + esc(sig.icono + ' ' + sig.titulo) + '</b>' : ' <b>Jornada completa.</b>') + '</span>' +
      (sig ? '<button type="button">Ir →</button>' : '') + '<button type="button" class="x" aria-label="Cerrar">✕</button>';
    document.body.appendChild(el);
    const b = el.querySelector('button:not(.x)');
    if (b) b.onclick = () => { el.remove(); this.ir(sig.id); };
    el.querySelector('.x').onclick = () => el.remove();
    setTimeout(() => { if (el.parentNode) el.remove(); }, 15000);
  },
  /** Barra de avance arriba de la página (solo si la página es parte de la jornada). */
  barra() {
    if (typeof document === 'undefined' || !this.enJornada()) return;
    if (this._pintar) { this._pintar(); return; } // ya está puesta: solo se repinta
    const pintar = () => {
      const j = this.actual();
      let el = document.getElementById('jornadaBarra');
      if (!j) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div');
        el.id = 'jornadaBarra';
        el.className = 'jornada-barra';
        document.body.insertBefore(el, document.body.firstChild);
      }
      const pasos = this.pasos(j), sig = this.siguiente(j);
      const aquiPaso = this.pasoDeEstaPagina();
      el.innerHTML = '<div class="jb-fila"><span class="jb-tit">🗂️ Jornada · <b>' + esc(j.atsCode) + '</b></span>' +
        '<button type="button" class="jb-ver">Ver pasos</button></div>' +
        '<div class="jb-pasos">' + pasos.map((p) => '<span class="jb-paso' + (p.hecho ? (p.hecho.omitido ? ' omit' : ' ok') : '') + '">' +
          (p.hecho ? (p.hecho.omitido ? '–' : '✓') : '○') + ' ' + esc(p.titulo) + '</span>').join('') + '</div>' +
        (!sig ? '<div class="jb-fin">✓ Jornada completa. <button type="button" class="jb-terminar">Terminar</button></div>'
          : (sig.id === aquiPaso && sig.id.indexOf('permiso:') === 0)
            ? '<div class="jb-aqui">✍️ Estás en este paso: diligencia y guarda el permiso para seguir.</div>'
            : '<button type="button" class="jb-sig" data-paso="' + esc(sig.id) + '">Siguiente: ' + esc(sig.icono + ' ' + sig.titulo) + ' →</button>');
      const bs = el.querySelector('.jb-sig');
      if (bs) bs.onclick = () => this.ir(sig.id);
      el.querySelector('.jb-ver').onclick = () => this.mostrarPanel();
      const bt = el.querySelector('.jb-terminar');
      if (bt) bt.onclick = () => { this.terminar(); };
    };
    this._pintar = pintar;
    pintar();
    window.addEventListener('jornada-cambio', pintar);
    window.addEventListener('storage', (e) => { if (e.key === this.KEY) pintar(); });
    window.addEventListener('pageshow', pintar);
  },
  /** Ventana con todos los pasos: abrir, omitir o terminar la jornada. */
  mostrarPanel() {
    const j = this.actual();
    if (!j) { alert('No hay una jornada en curso en este equipo.'); return; }
    const fondo = document.createElement('div');
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10001;display:flex;align-items:flex-end;justify-content:center;';
    const caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:680px;max-height:86vh;overflow:auto;padding:16px 16px 22px;font-family:var(--font-family,sans-serif);';
    fondo.appendChild(caja); document.body.appendChild(fondo);
    const cerrar = () => fondo.remove();
    fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
    const pinta = () => {
      const jj = this.actual();
      if (!jj) { cerrar(); return; }
      const pasos = this.pasos(jj);
      caja.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;"><h3 style="margin:0;font-size:16px;">🗂️ Jornada del ' + esc(jj.atsCode) + '</h3>' +
        '<button type="button" data-cerrar style="border:1px solid #dde3e8;background:#fff;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">Cerrar</button></div>' +
        '<p style="margin:6px 0 12px;font-size:12.5px;color:#5c6a76;line-height:1.45;">' + esc(jj.trabajo || '') + (jj.sitio ? ' · ' + esc(jj.sitio) : '') + '<br>Cada paso se abre con los datos y el personal del ATS (' + (jj.personas || []).length + ' persona(s)) ya puestos. Cada persona firma en cada formato.</p>' +
        pasos.map((p, i) => {
          const h = p.hecho;
          const estado = !h ? '<span style="color:#8a6408;font-weight:700;">Pendiente</span>'
            : h.omitido ? '<span style="color:#8a97a3;font-weight:700;">Omitido</span>'
            : '<span style="color:#1d7a4c;font-weight:700;">✓ ' + (h.code ? esc(h.code) : 'Hecho') + (h.pendiente ? ' (en cola)' : '') + '</span>';
          const acc = p.id === 'ats' ? '' :
            '<div style="display:flex;gap:7px;margin-top:8px;"><button type="button" data-abrir="' + esc(p.id) + '" style="flex:1;padding:10px;border:none;background:' + (h ? '#fff;border:1.5px solid #dde3e8;color:#151b24' : '#c9a227;color:#151b24') + ';border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">' + (h ? 'Abrir de nuevo' : 'Abrir ' + esc(p.titulo.toLowerCase())) + '</button>' +
            (h ? '' : '<button type="button" data-omitir="' + esc(p.id) + '" style="padding:10px 12px;border:1.5px solid #dde3e8;background:#fff;border-radius:8px;font-weight:700;font-size:12px;color:#5c6a76;cursor:pointer;">No aplica</button>') + '</div>';
          return '<div style="border:1px solid #dde3e8;border-radius:11px;padding:11px 12px;margin-bottom:8px;' + (h ? '' : 'border-left:4px solid #c9a227;') + '">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13.5px;"><b>' + (i + 1) + '. ' + esc(p.icono + ' ' + p.titulo) + '</b>' + estado + '</div>' + acc + '</div>';
        }).join('') +
        '<button type="button" data-terminar style="width:100%;margin-top:6px;padding:11px;border:1.5px solid #f0c8c1;background:#fff;color:#c0392b;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;">Terminar la jornada en este equipo</button>';
      caja.querySelector('[data-cerrar]').onclick = cerrar;
      caja.querySelectorAll('[data-abrir]').forEach((b) => { b.onclick = () => { cerrar(); this.abrir(b.dataset.abrir); }; });
      caja.querySelectorAll('[data-omitir]').forEach((b) => { b.onclick = () => { this.omitir(b.dataset.omitir); pinta(); }; });
      caja.querySelector('[data-terminar]').onclick = () => { if (confirm('¿Terminar la jornada? Lo que ya se guardó no se borra; solo se quita la barra de avance de este equipo.')) { this.terminar(); cerrar(); } };
    };
    pinta();
  }
};

/* ================= TRAER PERSONAL DE UN ATS =================
   La gente que firmó el ATS del día es casi siempre la misma que firma la
   charla y el anexo. Este selector lista los ATS abiertos y devuelve sus
   participantes (nombre, cédula, cargo) para agregarlos con un toque; cada
   persona firma de nuevo en el formato donde se agrega.
   Uso:  const r = await TraerDeAts.elegir();  // null si se cancela
         r → { code, trabajo, area, personas:[{nombre, cedula, cargo}] } */
const TraerDeAts = {
  elegir() {
    return new Promise((resolve) => {
      const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS && PORTAL_CONFIG.BACKENDS.ats) || {};
      if (!B.url) { alert('El ATS no tiene servidor configurado en config.js.'); resolve(null); return; }
      const fondo = document.createElement('div');
      fondo.className = 'tda-fondo';
      fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10001;display:flex;align-items:flex-end;justify-content:center;';
      const caja = document.createElement('div');
      caja.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:680px;max-height:82vh;overflow:auto;padding:16px 16px 22px;font-family:var(--font-family,sans-serif);';
      fondo.appendChild(caja);
      document.body.appendChild(fondo);
      const cerrar = (r) => { fondo.remove(); resolve(r); };
      fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(null); });
      const cab = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;"><h3 style="margin:0;font-size:16px;">🧭 Traer personal de un ATS</h3>' +
        '<button type="button" data-cerrar style="border:1px solid #dde3e8;background:#fff;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;">Cancelar</button></div>' +
        '<p style="margin:0 0 12px;font-size:12px;color:#5c6a76;line-height:1.45;">Se traen nombre, cédula y cargo de quienes están en el ATS. Cada persona debe firmar aquí.</p>';
      const pinta = (html) => { caja.innerHTML = cab + html; caja.querySelector('[data-cerrar]').onclick = () => cerrar(null); };
      pinta('<div style="text-align:center;color:#5c6a76;font-size:13px;padding:18px;">Buscando ATS abiertos…</div>');
      const token = encodeURIComponent(PORTAL_CONFIG.API_TOKEN);
      fetchWithRetry(B.url + '?list=1&token=' + token).then((r) => r.json()).then((data) => {
        if (!data || !data.ok || !Array.isArray(data.rows)) throw new Error((data && data.error) || 'el servidor del ATS no respondió con datos');
        const abiertos = data.rows.filter((r) => String(r.estado || '').toUpperCase() !== 'CERRADO')
          .sort((a, b) => String(b.fechaDesde || b.updatedAt || '').localeCompare(String(a.fechaDesde || a.updatedAt || ''))).slice(0, 40);
        if (!abiertos.length) { pinta('<div style="padding:14px;text-align:center;color:#5c6a76;font-size:13px;">No hay ATS abiertos en este momento.</div>'); return; }
        pinta(abiertos.map((r) => {
          const venc = (typeof atsVencido === 'function' && atsVencido(r)) ? ' · <b style="color:#c0392b;">vencido</b>' : '';
          const f = String(r.fechaDesde || '').slice(0, 10);
          return '<button type="button" data-ats="' + esc(r.code) + '" style="display:block;width:100%;text-align:left;border:1.5px solid #dde3e8;background:#fff;border-radius:11px;padding:11px 12px;margin-bottom:8px;cursor:pointer;font-family:inherit;">' +
            '<b style="font-size:13px;">' + esc(r.code) + '</b><span style="float:right;font-size:11px;font-weight:700;background:#eef1f4;border-radius:20px;padding:2px 8px;">' + (Number(r.participantes) || 0) + ' 👤</span><br>' +
            '<span style="font-size:12px;color:#151b24;">' + esc(String(r.trabajo || '').slice(0, 90)) + '</span><br>' +
            '<span style="font-size:11px;color:#5c6a76;">' + esc([f, r.area, r.centroCostos].filter(Boolean).join(' · ')) + venc + '</span></button>';
        }).join(''));
        caja.querySelectorAll('[data-ats]').forEach((b) => {
          b.onclick = async () => {
            const code = b.dataset.ats;
            b.disabled = true; b.style.opacity = '.6';
            try {
              const res = await fetchWithRetry(B.url + '?code=' + encodeURIComponent(code) + '&token=' + token);
              const j = await res.json();
              if (!j || !j.ok || !j.ats) throw new Error((j && j.error) || 'no se pudo abrir el ATS');
              const personas = (j.ats.participantes || []).map((p) => ({
                nombre: (String(p.nombres || '') + ' ' + String(p.apellidos || '')).trim() || String(p.nombre || '').trim(),
                cedula: String(p.cedula || '').trim(), cargo: String(p.cargo || '').trim()
              })).filter((p) => p.nombre);
              const cabAts = j.ats.cab || {};
              cerrar({ code, trabajo: cabAts.trabajo || '', area: cabAts.area || '', personas });
            } catch (e) {
              b.disabled = false; b.style.opacity = '1';
              alert('No se pudo traer el personal de ' + code + ': ' + e.message);
            }
          };
        });
      }).catch((e) => {
        pinta('<div style="padding:12px;background:#fdf1ef;border:1px solid #f0c8c1;color:#8a2a1c;border-radius:10px;font-size:12.5px;line-height:1.45;">No se pudo consultar los ATS: ' + esc(e.message || 'sin conexión') + '.</div>');
      });
    });
  }
};

/* ================= VIGENCIA DE UN ATS =================
   Un ATS vale hasta el final del día de su fecha "hasta" (o de su fecha
   "desde" si no tiene). Después de eso, si sigue abierto, está VENCIDO: es
   de lo primero que se marca en una auditoría. Lo usan el tablero, el
   inicio y las listas del ATS. */
function atsVence(row) {
  const f = String((row && (row.fechaHasta || row.fechaDesde)) || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 0, 0);
}
function atsVencido(row) {
  if (!row || row.estado === 'CERRADO') return false;
  const v = atsVence(row);
  return !!v && v.getTime() < Date.now();
}

/* ================= AVISO: SIN BASE DE PERSONAL =================
   Antes era un recuadro rojo flotante abajo a la izquierda que tapaba
   botones y el contador de "preguntas sin responder". Ahora es una franja
   delgada arriba de la página, con "¿Por qué?" y una ✕ para cerrarla (queda
   cerrada mientras no se cierre la pestaña). Lo usan el ATS y los permisos. */
const AvisoPersonal = {
  CLAVE: 'ssta-aviso-personal-cerrado',
  mostrar(motivo, reintentar) {
    let cerrado = false;
    try { cerrado = sessionStorage.getItem(this.CLAVE) === '1'; } catch (e) {}
    let el = document.getElementById('avisoPersonal');
    if (cerrado) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'avisoPersonal';
      el.className = 'aviso-personal';
      el.setAttribute('role', 'status');
      el.innerHTML = '<span class="txt"></span><button type="button" class="por-que">¿Por qué?</button><button type="button" class="cerrar" aria-label="Cerrar aviso">✕</button>';
      document.body.insertBefore(el, document.body.firstChild);
      el.querySelector('.cerrar').addEventListener('click', () => {
        try { sessionStorage.setItem(this.CLAVE, '1'); } catch (e) {}
        el.remove();
      });
    }
    el.querySelector('.txt').textContent = '⚠️ Sin base de personal: escribe nombres y cédulas a mano, no se pierde nada.';
    const pq = el.querySelector('.por-que');
    pq.onclick = () => {
      alert('Búsqueda de personal no disponible\n\n' + (motivo || 'No se pudo cargar la base de personal.') + '\n\nPuedes seguir escribiendo nombres y cédulas a mano; no se pierde nada.\n\nSe va a reintentar ahora.');
      el.querySelector('.txt').textContent = '⏳ Reintentando…';
      if (reintentar) reintentar();
    };
  },
  ocultar() { const el = document.getElementById('avisoPersonal'); if (el) el.remove(); }
};

/**
 * DraftStore: guarda/recupera un borrador del formulario en localStorage
 * para que no se pierda el trabajo si se cierra la pestaña, se va la señal
 * o el celular bloquea la página a medio llenar.
 */
const DraftStore = {
  _avisoMostrado: false,
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, savedAt: new Date().toISOString() }));
      return true;
    } catch (e) {
      // El guardado automático del borrador falló (cuota de almacenamiento
      // llena por firmas en base64, modo privado de Safari, etc.). Antes esto
      // se ignoraba en silencio: el usuario creía tener un respaldo local que
      // en realidad no existe. Se avisa una sola vez por sesión — no en cada
      // tecla, ya que save() se llama muy seguido mientras se escribe.
      if (!this._avisoMostrado) {
        this._avisoMostrado = true;
        console.error('DraftStore.save falló:', e);
        window.dispatchEvent(new CustomEvent('draft-guardado-fallido', { detail: { error: e } }));
      }
      return false;
    }
  },
  load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },
  clear(key) {
    try { localStorage.removeItem(key); } catch (e) { /* no-op */ }
  }
};

// Aviso visible si el borrador automático deja de poder guardarse — se activa
// solo (no necesita que cada página lo llame), ya que common.js está en todas.
window.addEventListener('draft-guardado-fallido', () => {
  if (document.getElementById('draftFailBanner')) return;
  const el = document.createElement('div');
  el.id = 'draftFailBanner';
  el.setAttribute('role', 'alert');
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#b3261e;color:#fff;font-weight:600;font-size:13px;padding:10px 14px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:space-between;gap:10px;';
  el.innerHTML = '<span>⚠️ El respaldo automático de este formulario no se está guardando en este dispositivo (memoria llena o modo privado). Si cierras la página sin guardar, podrías perder lo escrito — guarda cuanto antes.</span>';
  const btn = document.createElement('button');
  btn.textContent = '✕';
  btn.style.cssText = 'background:none;border:none;color:#fff;font-size:16px;cursor:pointer;flex-shrink:0;';
  btn.addEventListener('click', () => el.remove());
  el.appendChild(btn);
  document.body.appendChild(el);
});

/** debounce: evita guardar en cada tecla; agrupa cambios rápidos en uno solo. */
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Formatea una fecha ISO a texto legible en español. */
function formatSavedAt(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

/**
 * OfflineBanner: muestra/oculta un aviso fijo cuando el navegador detecta
 * que no hay conexión, para que en zonas de planta con señal débil quede
 * claro que lo que se ve puede ser una copia guardada (caché) y no la
 * versión más reciente. No interfiere con el borrador local: ese sigue
 * guardando normalmente sin conexión.
 */
/**
 * UpdateManager: detecta cuando hay una versión nueva del portal ya
 * descargada (Service Worker "esperando") y muestra un banner para que
 * el usuario decida cuándo actualizar — nunca se recarga la página solo,
 * para no perder un permiso a medio llenar.
 * Requiere sw.js v2 (que no hace skipWaiting automático).
 */
/* Versión del portal (sitio). El panel del asesor la compara con la del servidor de cada cliente. */
const VERSION_PORTAL_WEB = 'v128';

const UpdateManager = {
  init() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Ya hay un SW nuevo esperando desde antes de esta carga.
      if (reg.waiting) this._showBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            this._showBanner(nuevo);
          }
        });
      });
    }).catch(() => {});

    // Cuando el SW nuevo toma control, recarga una sola vez.
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando) return;
      recargando = true;
      location.reload();
    });

    // Mensaje del SW pidiendo reintentar la cola pendiente (background sync).
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data === 'TRY_FLUSH_OUTBOX') Outbox.flush();
    });
  },
  _showBanner(worker) {
    if (document.getElementById('updateBanner')) return;
    const el = document.createElement('div');
    el.id = 'updateBanner';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span>🔄 Hay una versión nueva del portal disponible.</span>
      <button type="button" id="updateBannerBtn">Actualizar ahora</button>`;
    document.body.prepend(el);
    document.getElementById('updateBannerBtn').addEventListener('click', () => {
      worker.postMessage('SKIP_WAITING');
      el.remove();
    });
  }
};

/**
 * Outbox: cola de permisos que no se pudieron guardar por falta de señal.
 * Usa IndexedDB (no localStorage) porque el Service Worker también debe
 * poder leerla/escribirla en segundo plano vía Background Sync.
 * Uso desde los formularios (dentro del catch de fetchWithRetry):
 *   await Outbox.add(CONFIG.SCRIPT_URL, { action:'open', code, data, token });
 * Y al cargar la página: Outbox.flush();  // reintenta lo pendiente
 */
const Outbox = {
  _dbPromise: null,
  _flushing: false, // evita que dos disparos simultáneos (carga de página + evento 'online'
                     // + mensaje del Service Worker) reenvíen el mismo permiso dos veces
  _db() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('ssta-outbox', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._dbPromise;
  },
  /**
   * Encola un permiso pendiente. A diferencia de la versión anterior, la
   * promesa ahora SÍ rechaza si IndexedDB no pudo guardar el registro
   * (cuota llena por las firmas en base64, modo privado de Safari, etc.).
   * Antes la promesa quedaba colgada para siempre y el formulario le
   * mostraba al usuario "quedó guardado y se reintentará solo" sin que
   * realmente hubiera quedado nada guardado — quien llama debe hacer
   * await y avisar al usuario si esto rechaza.
   */
  async add(url, body) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      // v116: lo de la consola del administrador y lo del portal de un cliente no se mezclan en la cola
      // (cada uno sale con su clave y su sesión, y solo desde su lado).
      const nuevo = { url, body, savedAt: new Date().toISOString(), intentos: 0, ambito: Consola.activa() ? 'consola' : 'portal' };
      // v110: la misma operación (mismo opId) no se encola dos veces: si alguien
      // vuelve a guardar sin señal, queda solo la versión más reciente.
      const op = body && body.opId;
      if (!op) store.add(nuevo);
      else {
        const cur = store.openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { const v = c.value; if (v.url === url && v.body && v.body.opId === op) c.delete(); c.continue(); }
          else store.add(nuevo);
        };
      }
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Outbox: transacción abortada'));
      tx.oncomplete = () => {
        // Ya quedó guardado en la cola: se confirma YA. Antes se esperaba a
        // que el Service Worker estuviera listo para registrar el Background
        // Sync, y si el Service Worker no estaba activo (primera visita, modo
        // privado, registro fallido) esa espera no terminaba nunca: el botón
        // quedaba en "Guardando…" y el aviso de "quedó en cola" no salía.
        Outbox._avisar();
        resolve();
        // El Background Sync se registra aparte, sin bloquear. Si el navegador
        // no lo soporta, igual se reintenta al volver la señal o al recargar.
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready
            .then((reg) => reg.sync.register('sync-outbox'))
            .catch(() => { /* sin soporte o permiso denegado; no es crítico */ });
        }
      };
    });
  },
  async list() {
    const db = await this._db();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readonly');
      const req = tx.objectStore('pending').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
  },
  async remove(id) {
    const db = await this._db();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').delete(id);
      tx.oncomplete = () => resolve();
    });
  },
  async _incrementarIntentos(id) {
    const db = await this._db();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) { item.intentos = (item.intentos || 0) + 1; store.put(item); }
        resolve(item ? item.intentos : 0);
      };
      getReq.onerror = () => resolve(0);
    });
  },
  /** Reintenta enviar todo lo pendiente. Llamar al cargar la página y al volver la señal. */
  async flush() {
    if (!navigator.onLine) return;
    if (this._flushing) return;
    this._flushing = true;
    try {
      const items = await this.list();
      // Cambios del MISMO registro SG-SST (crear, luego FURAT, luego cierre…):
      // si uno no sale, los que siguen esperan a la próxima pasada, para que
      // lleguen en orden y uno viejo no pise a uno nuevo.
      const trabados = new Set();
      const claveDoc = (it) => (it.body && it.body.id && /^(guardar|parche|borrar|adjuntar|quitarAdjunto)$/.test(it.body.action || '')) ? it.url + '|' + it.body.id : null;
      const ambito = Consola.activa() ? 'consola' : 'portal';
      for (const item of items) {
        if ((item.ambito || 'portal') !== ambito) continue;
        const cd = claveDoc(item);
        if (cd && trabados.has(cd)) continue;
        if (cd) trabados.add(cd);   // se suelta abajo si salió
        // Lo que quedó en cola se envía con la clave VIGENTE, no con la que
        // había cuando se guardó (si la clave cambió, el envío fallaría).
        if (item.body && Object.prototype.hasOwnProperty.call(item.body, 'token') && typeof PORTAL_CONFIG !== 'undefined') item.body.token = PORTAL_CONFIG.API_TOKEN;
        // SG-SST con usuarios: sale con la sesión vigente (también lo que quedó en cola antes de los usuarios).
        // v112: igual para los permisos, el ATS y lo demás de la obra (todo lo del servidor del portal).
        if (item.body && typeof Sesion !== 'undefined' && ((typeof SGSST !== 'undefined' && SGSST.url() && item.url === SGSST.url()) || Outbox._delPortal(item.url))) item.body.sesion = Sesion.paraReenvio(item.body.sesion, item.sesionRechazada);
        try {
          const res = await fetch(item.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(item.body)
          });
          // Se lee como texto: si el servidor responde con una PÁGINA (error de
          // Apps Script, inicio de sesión, implementación borrada), antes eso se
          // confundía con "sin señal" y el pendiente quedaba en cola sin decir
          // por qué. Ahora se guarda lo que respondió y se ve en la lista.
          const texto = await res.text();
          let json;
          try { json = JSON.parse(texto); }
          catch (errParse) {
            await Outbox._anotarError(item.id, Outbox.describirPagina(texto, res.status));
            continue;
          }
          if (json.ok) {
            await this.remove(item.id);
            Outbox._avisarEnviado(item);
          } else if (Outbox._esTemporal(json)) {
            // El servidor estaba ocupado (bloqueo, servicio de Google caído un
            // momento): no es culpa del registro. Se conserva SIN contar el
            // intento; se reenvía solo en la próxima pasada.
            await Outbox._anotarError(item.id, 'El servidor estaba ocupado; se reintenta solo. (' + (json.error || 'temporal') + ')');
          } else if (json.codigoError === 'SESION' || json.codigoError === 'CAMBIAR') {
            // Falta entrar con el usuario (o cambiar la clave temporal): no es un
            // error del registro. Se conserva sin contar el intento.
            await Outbox._anotarError(item.id, json.codigoError === 'CAMBIAR' ? 'Cambia tu clave temporal (botón 👤) para enviarlo.' : 'Entra con tu usuario (botón 👤) para enviarlo.', json.codigoError === 'SESION');
            if (typeof Sesion !== 'undefined' && json.codigoError === 'SESION' && item.body && item.body.sesion && item.body.sesion === Sesion.token()) Sesion.rechazada();
            if (typeof Sesion !== 'undefined' && !Sesion.get()) Sesion.pintarChip();
          } else if (ClavePortal.esErrorDeClave(json)) {
            // Clave faltante o vieja: NO es un error del permiso. Antes, a los 5
            // intentos se sacaba de la cola y se perdía. Se conserva y se pide
            // la clave; al guardarla se reenvía.
            await Outbox._anotarError(item.id, 'El servidor no aceptó la clave del portal de este equipo.');
            ClavePortal.pedir();
          } else {
            // El servidor respondió pero con error (token inválido, permiso ya
            // cerrado, etc.) — no es un problema de señal, así que reintentar
            // sin límite nunca lo resolvería solo. Tras 5 intentos fallidos se
            // saca de la cola y se avisa, en vez de reintentar para siempre.
            await Outbox._anotarError(item.id, 'El servidor respondió: ' + (json.error || 'error sin detalle'));
            const intentos = await this._incrementarIntentos(item.id);
            if (intentos >= 5) {
              await this.remove(item.id);
              Outbox._avisarFallidoDefinitivo(item, json.error);
            }
          }
        } catch (e) {
          // No hubo respuesta. Puede ser que no haya señal… o que el envío SÍ
          // llegara y se perdiera la respuesta de vuelta: en ese caso el permiso
          // ya está guardado y este pendiente quedaría en cola para siempre,
          // mostrando un aviso que no corresponde. Se comprueba preguntándole al
          // servidor si ese código ya existe.
          const yaEsta = await Outbox._yaFueGuardado(item);
          if (yaEsta) {
            await this.remove(item.id);
            Outbox._avisarEnviado(item);
          } else {
            await Outbox._anotarError(item.id, navigator.onLine
              ? 'No hubo respuesta legible del servidor (' + ((e && e.message) || 'error de red') + '). Con buena señal, esto casi siempre es un ERROR DENTRO DEL SCRIPT: Google lo responde de una forma que el navegador no deja leer. En Apps Script → «Ejecuciones» (ícono de reloj) aparece el error exacto.'
              : 'Sin conexión.');
          }
          // Si no se pudo comprobar, se deja en cola y se reintenta luego.
        }
        if (cd && !(await this.list()).some((x) => x.id === item.id)) trabados.delete(cd);
      }
    } finally {
      this._flushing = false;
      Outbox._avisar();
    }
  },
  async count() {
    return (await this.list()).length;
  },
  /** Texto legible de una respuesta que no es de datos (página de Google). */
  describirPagina(html, status) {
    const t = String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    let causa = '';
    if (/inicia(r)? sesi|sign in|acceder|cuenta de google|accounts\.google/i.test(t)) causa = ' Parece la pantalla de inicio de sesión de Google: la implementación no está con «Acceso: Cualquier usuario».';
    else if (/autoriza|authoriz|permis/i.test(t)) causa = ' Parece que falta autorizar el script: en Apps Script ejecuta cualquier función una vez (▶) y acepta los permisos.';
    else if (/no se ha encontrado|not found|no encontr|404/i.test(t + status)) causa = ' La URL no corresponde a una implementación activa: revisa la URL en config.js.';
    else if (/error|exception|línea|line \d/i.test(t)) causa = ' Es un error dentro del script.';
    return 'El servidor respondió con una página en vez de datos (HTTP ' + status + ').' + causa + (t ? ' Texto: «' + t.slice(0, 260) + (t.length > 260 ? '…' : '') + '»' : '');
  },
  /* Error del servidor que se arregla solo al reintentar (no debe agotar los 5 intentos). */
  /** v112: ¿esta dirección es del servidor del portal de la empresa (cualquier módulo)? */
  _delPortal(url) {
    try { const base = typeof EMPRESA !== 'undefined' && EMPRESA.servidor ? String(EMPRESA.servidor).replace(/\/+$/, '') : ''; return !!base && String(url || '').indexOf(base + '/') === 0; } catch (e) { return false; }
  },
  _esTemporal(json) {
    return !!json && (json.codigoError === 'TEMPORAL' ||
      /lock timeout|timed out|tiempo de espera|bloqueo|Service (?:invoked too many times|Spreadsheets failed|unavailable)|servicio no disponible|try again later/i.test(String(json.error || '')));
  },
  async _anotarError(id, msg, sesionRechazada) {
    try {
      const db = await this._db();
      await new Promise((resolve) => {
        const tx = db.transaction('pending', 'readwrite');
        const store = tx.objectStore('pending');
        const g = store.get(id);
        g.onsuccess = () => { const it = g.result; if (it) { it.ultimoError = msg; it.ultimoIntento = new Date().toISOString(); if (sesionRechazada) it.sesionRechazada = true; store.put(it); } };
        tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); tx.onabort = () => resolve();
      });
    } catch (e) { /* no es crítico */ }
  },
  /** ¿El permiso de este pendiente ya está guardado en el servidor? Se usa para
   *  no dejar en cola algo que en realidad ya se envió. Devuelve false ante
   *  cualquier duda (sin señal, respuesta rara): más vale reintentar de más que
   *  descartar un permiso que no se guardó. */
  async _yaFueGuardado(item) {
    try {
      const code = item.body && (item.body.permitCode || item.body.code);
      const token = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.API_TOKEN) || (item.body && item.body.token);
      // Registro diario del anexo: no tiene código; se busca por obra y fecha y
      // cuenta como enviado solo si ESE guardado (su opId) ya está aplicado.
      if (item.body && item.body.action === 'guardarRegistro') {
        if (!item.body.opId || !token) return false;
        const r = await fetch(item.url + '?action=registro&obraId=' + encodeURIComponent(item.body.obraId) + '&fecha=' + encodeURIComponent(item.body.fecha) + '&token=' + encodeURIComponent(token));
        const j = await r.json();
        return !!(j && Array.isArray(j.opIds) && j.opIds.indexOf(item.body.opId) !== -1);
      }
      // SG-SST (habilitación, reportes, plan de acción, inspecciones…): se
      // pregunta si ESE envío (su opId) ya quedó aplicado.
      if (item.body && /^(guardar|parche|borrar|adjuntar|quitarAdjunto)$/.test(item.body.action || '') && item.body.id) {
        if (!item.body.opId || !token) return false;
        const r = await fetch(item.url + '?action=opAplicado&opId=' + encodeURIComponent(item.body.opId) + '&token=' + encodeURIComponent(token));
        const j = await r.json();
        return !!(j && j.ok && j.aplicado);
      }
      if (!code || !token) return false;
      const res = await fetch(item.url + '?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(token));
      const json = await res.json();
      if (!json || !json.ok) return false;
      // Un "agregar personal" del ATS solo cuenta como guardado si cada una de
      // esas personas ya aparece en el ATS del servidor (que el ATS exista no
      // basta: si se diera por enviado, esas firmas se perderían).
      if (item.body.action === 'agregarParticipantes') {
        const hay = (json.ats && json.ats.participantes) || [];
        return (item.body.participantes || []).every((p) =>
          hay.some((q) => (p.uid && q.uid === p.uid) || (String(p.cedula || '').trim() && String(q.cedula || '').trim() === String(p.cedula).trim())));
      }
      // Si el pendiente era un CIERRE, solo cuenta como guardado si allá ya
      // figura cerrado; si no, el cierre todavía tiene que salir.
      if (item.body.status === 'CERRADO') return json.status === 'CERRADO';
      if (item.body.action === 'cerrarAts') return json.estado === 'CERRADO';
      // Una charla solo cuenta como enviada si ESE guardado (su opId) ya está
      // aplicado en la semana: que la semana exista no basta, las firmas de
      // ese día se perderían.
      if (item.body.action === 'guardarDia') return !!(json.semana && (json.semana.opIds || []).indexOf(item.body.opId) !== -1);
      return true;
    } catch (e) { return false; }
  },
  _avisar() {
    window.dispatchEvent(new CustomEvent('outbox-cambio'));
  },
  _avisarEnviado(item) {
    window.dispatchEvent(new CustomEvent('outbox-enviado', { detail: item }));
  },
  _avisarFallidoDefinitivo(item, error) {
    window.dispatchEvent(new CustomEvent('outbox-fallido', { detail: { item, error } }));
  }
};
window.addEventListener('online', () => Outbox.flush());

/**
 * OutboxBadge: indicador visible ("N permisos pendientes de enviar") para que
 * el usuario sepa en todo momento si algo quedó en cola sin salir — antes,
 * un permiso podía quedar guardándose en segundo plano sin ningún aviso.
 * Se actualiza solo con los eventos que dispara Outbox.
 */
const OutboxBadge = {
  /* Qué es cada pendiente, según el servidor al que va. Antes todo decía
     "permiso", aunque fuera un ATS o una inspección de EPP. */
  tipoDe(item) {
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const k = Object.keys(B).find((x) => B[x] && B[x].url && B[x].url === item.url);
    if (k === 'ats') return { uno: 'ATS', varios: 'ATS', articulo: 'Un', detalle: 'ATS' };
    if (k === 'epp') return { uno: 'inspección de EPP', varios: 'inspecciones de EPP', articulo: 'Una', detalle: 'Inspección de EPP' };
    if (k === 'personal') return { uno: 'registro de personal', varios: 'registros de personal', articulo: 'Un', detalle: 'Personal autorizado' };
    if (k === 'asistencia') return { uno: 'charla', varios: 'charlas', articulo: 'Una', detalle: 'Asistencia a charla' };
    if (k === 'sgsst') {
      const t = { trabajador: 'Personal habilitado', reporte: 'Reporte SST', accion: 'Plan de acción', mes: 'Indicadores', equipo: 'Equipo', inspeccion: 'Inspección' }[item.body && item.body.tipo] || 'Gestión SST';
      return { uno: 'registro SST', varios: 'registros SST', articulo: 'Un', detalle: t };
    }
    const nombre = k && B[k].nombre ? B[k].nombre : '';
    return { uno: 'permiso', varios: 'permisos', articulo: 'Un', detalle: nombre ? 'Permiso · ' + nombre : 'Permiso' };
  },
  textoBadge(items) {
    const n = items.length;
    const tipos = items.map((it) => this.tipoDe(it));
    const mismo = tipos.every((t) => t.uno === tipos[0].uno);
    if (mismo) return '⏳ ' + n + ' ' + (n === 1 ? tipos[0].uno + ' pendiente' : tipos[0].varios + ' pendientes') + ' de enviar';
    return '⏳ ' + n + ' registros pendientes de enviar';
  },
  init() {
    if (document.getElementById('outboxBadge')) return;
    const el = document.createElement('div');
    el.id = 'outboxBadge';
    el.style.cssText = 'display:none;position:fixed;left:12px;bottom:12px;z-index:9997;background:#c9a227;color:#151b24;font-weight:700;font-size:12.5px;padding:8px 14px;border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,.25);';
    document.body.appendChild(el);
    const actualizar = async () => {
      const items = await Outbox.list();
      const n = items.length;
      if (n > 0) {
        el.textContent = OutboxBadge.textoBadge(items);
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    };
    window.addEventListener('outbox-cambio', actualizar);
    window.addEventListener('outbox-enviado', (ev) => {
      actualizar();
      const t = ev && ev.detail && ev.detail.url ? OutboxBadge.tipoDe(ev.detail) : { uno: 'registro', articulo: 'Un' };
      const aviso = document.createElement('div');
      aviso.textContent = '✓ ' + t.articulo + ' ' + t.uno + ' pendiente se envió correctamente.';
      aviso.style.cssText = 'position:fixed;left:12px;bottom:52px;z-index:9998;background:#1d7a4c;color:#fff;font-weight:600;font-size:12.5px;padding:8px 14px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.25);';
      document.body.appendChild(aviso);
      setTimeout(()=> aviso.remove(), 5000);
    });
    window.addEventListener('outbox-fallido', (e) => {
      actualizar();
      const t = e.detail && e.detail.item ? OutboxBadge.tipoDe(e.detail.item) : { uno: 'registro' };
      alert('No se pudo enviar ' + (t.uno === 'ATS' ? 'un ATS' : 'un(a) ' + t.uno) + ' guardado en cola, incluso con señal (' + (e.detail.error || 'error del servidor') + '). Revísalo manualmente: puede que haya que volver a intentarlo desde el formulario.');
    });

    // El aviso ahora se puede TOCAR para ver qué hay en cola. Antes solo decía
    // "N pendientes" sin forma de saber cuáles ni de quitarlos: si alguno se
    // quedaba trabado, el aviso se volvía permanente y dejaba de significar algo.
    el.style.cursor = 'pointer';
    el.title = 'Toca para ver qué está pendiente';
    el.addEventListener('click', () => OutboxBadge.verPendientes());

    actualizar();
  },

  async verPendientes() {
    const items = await Outbox.list();
    if (!items.length) { alert('No hay nada pendiente de enviar.'); return; }

    const fondo = document.createElement('div');
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;';
    const caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;border-radius:14px;max-width:460px;width:100%;max-height:80vh;overflow:auto;padding:18px;font-family:var(--font-family,sans-serif);';
    fondo.appendChild(caja);

    const pinta = (lista) => {
      caja.innerHTML =
        '<h3 style="margin:0 0 4px;font-size:16px;">Pendientes de enviar</h3>' +
        '<p style="margin:0 0 14px;font-size:12.5px;color:#5c6a76;line-height:1.5;">' +
        'Esto se guardó en el celular pero no se ha confirmado que llegara al servidor. ' +
        'Si ya los ves en el dashboard, es que sí llegaron y la confirmación se perdió: usa «Comprobar» para limpiarlos.</p>' +
        lista.map((it,i)=>{
          const code = (it.body && (it.body.permitCode || it.body.code)) || 'sin código';
          const cierre = it.body && (it.body.status === 'CERRADO' || it.body.action === 'cerrarAts');
          const agrego = it.body && (it.body.action === 'agregarParticipantes' || it.body.action === 'addWorkers');
          const tipo = OutboxBadge.tipoDe(it);
          const f = new Date(it.savedAt);
          const cuando = isNaN(f.getTime()) ? '' : f.toLocaleDateString('es-CO') + ' ' + f.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
          return '<div style="border:1px solid #dde3e8;border-radius:9px;padding:11px;margin-bottom:9px;font-size:12.5px;line-height:1.5;">' +
            '<span style="color:#5c6a76;font-size:11.5px;">' + esc(tipo.detalle) + '</span><br>' +
            '<b>' + esc(code) + '</b>' + (cierre ? ' <span style="color:#c0392b;">(cierre)</span>' : (agrego ? ' (personal agregado)' : ' (apertura o cambios)')) +
            '<br><span style="color:#5c6a76;">Guardado: ' + esc(cuando) + (it.intentos ? ' · ' + it.intentos + ' intento(s)' : '') + '</span>' +
            (it.ultimoError ? '<div style="margin-top:7px;background:#fdf1ef;border:1px solid #f0c8c1;color:#8a2a1c;border-radius:7px;padding:7px 9px;font-size:11.5px;line-height:1.45;overflow-wrap:anywhere;"><b>Último intento:</b> ' + esc(it.ultimoError) + '</div>' : '') +
            '<div style="display:flex;gap:7px;margin-top:9px;">' +
            '<button data-comprobar="' + it.id + '" style="flex:1;padding:9px;border:1px solid #1f6f8b;background:#fff;color:#1f6f8b;border-radius:7px;font-weight:700;font-size:12px;cursor:pointer;">Comprobar</button>' +
            '<button data-descartar="' + it.id + '" style="padding:9px 12px;border:1px solid #e08a80;background:#fff;color:#c0392b;border-radius:7px;font-weight:700;font-size:12px;cursor:pointer;">Descartar</button>' +
            '</div></div>';
        }).join('') +
        '<button id="obxReenviar" style="width:100%;padding:12px;border:none;background:#c9a227;color:#151b24;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;margin:2px 0 8px;">↻ Reenviar ahora</button>' +
        '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button id="obxTodos" style="flex:1;padding:12px;border:none;background:#151b24;color:#fff;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">Comprobar todos</button>' +
        '<button id="obxCerrar" style="padding:12px 16px;border:1px solid #dde3e8;background:#fff;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">Cerrar</button>' +
        '</div>';

      caja.querySelector('#obxCerrar').onclick = () => fondo.remove();
      const btnRe = caja.querySelector('#obxReenviar');
      btnRe.onclick = async () => {
        btnRe.disabled = true; btnRe.textContent = 'Reenviando…';
        await Outbox.flush();
        const quedan = await Outbox.list();
        if (!quedan.length) { fondo.remove(); alert('✓ Todo se envió correctamente.'); return; }
        pinta(quedan);
      };

      const comprobar = async (item) => {
        const ya = await Outbox._yaFueGuardado(item);
        if (ya) { await Outbox.remove(item.id); return true; }
        return false;
      };

      caja.querySelectorAll('[data-comprobar]').forEach(b=>{
        b.onclick = async () => {
          b.disabled = true; b.textContent = 'Comprobando…';
          const item = lista.find(x=>String(x.id)===b.dataset.comprobar);
          const ya = await comprobar(item);
          if (ya) { alert('Eso SÍ está guardado en el servidor. Se quita de la cola.'); }
          else { alert('Todavía no aparece en el servidor. Se deja en cola para reintentarlo.'); }
          Outbox._avisar();
          const quedan = await Outbox.list();
          quedan.length ? pinta(quedan) : fondo.remove();
        };
      });

      caja.querySelectorAll('[data-descartar]').forEach(b=>{
        b.onclick = async () => {
          if (!confirm('¿Descartar este pendiente? Si no llegó al servidor, se pierde y habrá que volver a diligenciarlo.')) return;
          await Outbox.remove(b.dataset.descartar);
          Outbox._avisar();
          const quedan = await Outbox.list();
          quedan.length ? pinta(quedan) : fondo.remove();
        };
      });

      const btnTodos = caja.querySelector('#obxTodos');
      btnTodos.onclick = async () => {
        btnTodos.disabled = true; btnTodos.textContent = 'Comprobando…';
        let limpiados = 0;
        for (const it of lista) { if (await comprobar(it)) limpiados++; }
        Outbox._avisar();
        const quedan = await Outbox.list();
        alert(limpiados
          ? limpiados + ' de ' + lista.length + ' ya estaban guardados en el servidor y se quitaron de la cola.'
          : 'Ninguno aparece todavía en el servidor. Se dejan en cola.');
        quedan.length ? pinta(quedan) : fondo.remove();
      };
    };

    pinta(items);
    fondo.addEventListener('click', (e)=>{ if (e.target === fondo) fondo.remove(); });
    document.body.appendChild(fondo);
  }
};

/**
 * SignaturePad: lienzo táctil de firma (dibujar, deshacer trazo, borrar,
 * cargar una firma ya guardada). Antes esta misma lógica (~80 líneas)
 * vivía copiada y pegada en permiso-core.js Y en personal-autorizado.html
 * por separado — un arreglo hecho en un lado (como el bug de firmas que
 * quedaban invisibles al restaurar varias de golpe) había que acordarse
 * de repetirlo a mano en el otro. Ahora vive en un solo lugar y ambos
 * consumidores comparten la misma implementación.
 *
 * Cada página que la usa crea SU PROPIO manager (no hay estado global
 * compartido entre, por ejemplo, un permiso y el anexo de personal):
 *
 *   const sigMgr = SignaturePad.createManager({
 *     statusIdFor: (canvasId) => 'status_' + canvasId  // opcional, este es el default
 *   });
 *   sigMgr.setup(canvasEl);
 *   sigMgr.pads['idDelCanvas'].setDataUrl(firmaGuardada);
 *   sigMgr.refreshIn(contenedor); // ver nota de refreshSize más abajo
 *
 * IMPORTANTE sobre restaurar firmas guardadas en lote (varias filas a la
 * vez, ej. varios ejecutantes de un permiso ya abierto): llama primero
 * refreshIn()/setup() para que el lienzo tenga su tamaño real, y solo
 * después dibuja la firma con setDataUrl — si el <canvas> todavía no está
 * visible (contenedor recién mostrado, sección aún colapsada) su tamaño
 * puede ser 0x0 en ese instante y la firma se "dibuja" en un lienzo sin
 * tamaño, quedando invisible aunque el dato sí se guardó bien.
 */
const SignaturePad = {
  createManager(opts) {
    opts = opts || {};
    const statusIdFor = opts.statusIdFor || ((id) => 'status_' + id);
    const signedLabel = opts.signedLabel || 'Firmado ✓';
    const unsignedLabel = opts.unsignedLabel || 'Sin firmar';
    const pads = {};

    function markSigned(id) {
      const el = document.getElementById(statusIdFor(id));
      if (el) { el.textContent = signedLabel; el.classList.add('done', 'signed'); }
      const c = document.getElementById(id);
      if (c) c.classList.add('con-firma'); // quita la pista "Toca aquí para firmar"
    }
    function markUnsigned(id) {
      const el = document.getElementById(statusIdFor(id));
      if (el) { el.textContent = unsignedLabel; el.classList.remove('done', 'signed'); }
      const c = document.getElementById(id);
      if (c) c.classList.remove('con-firma');
    }

    function setup(canvas) {
      if (canvas.dataset.sigInit) return; // este MISMO elemento ya tiene sus listeners
      canvas.dataset.sigInit = '1';
      // En celular, tocar el recuadro abre la firma a pantalla completa (ver
      // FirmaCompleta). Se registra ANTES que los de dibujo para poder frenar
      // el trazo en el recuadro pequeño. En tablet o computador no hace nada.
      if (!canvas.dataset.completa) {
        canvas.addEventListener('touchstart', (e) => {
          if (canvas.dataset.locked === '1' || !FirmaCompleta.usar()) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          FirmaCompleta.abrir(canvas, pads[canvas.id]);
        }, { passive: false });
      }
      // willReadFrequently: true — le dice al navegador desde el inicio que este
      // lienzo se va a LEER seguido (getImageData para el historial de "deshacer",
      // toDataURL al guardar), no solo dibujar. Sin esto, el navegador por defecto
      // asume que el canvas es para dibujar-y-mostrar nada más, y lo maneja con
      // memoria de video (GPU) — en dispositivos con poca memoria y varias firmas
      // abiertas a la vez en la misma pantalla (los 5-6 recuadros de un permiso),
      // esa memoria de video puede liberarse en segundo plano para los lienzos que
      // quedan fuera de pantalla mientras se sigue llenando el formulario, dejando
      // el dibujo en blanco silenciosamente aunque el estado siga diciendo
      // "Firmado ✓" (ese estado es solo texto, no depende del contenido del
      // lienzo). Con willReadFrequently, el navegador usa memoria normal (CPU) en
      // vez de memoria de video, evitando ese vaciado.
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // Historial para "deshacer trazo".
      // ANTES se guardaba una FOTO completa del lienzo por cada trazo (hasta 15).
      // En una tablet de pantalla densa cada foto pesa ~7 MB sin comprimir, así
      // que un solo recuadro podía ocupar ~108 MB y un permiso con 9 firmas casi
      // 1 GB — suficiente para que el navegador matara y recargara la pestaña sin
      // avisar. Ahora se guardan los TRAZOS (las coordenadas por donde pasó el
      // dedo) y el lienzo se redibuja: unos pocos kilobytes, sin tope práctico,
      // y el deshacer queda exacto en vez de aproximado.
      let strokes = [];      // trazos dibujados en esta sesión, en píxeles CSS
      let baseImage = null;  // firma ya existente restaurada de fondo (si la hay)
      function redibujar() {
        const ratio = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (baseImage) {
          ctx.drawImage(baseImage, 0, 0, canvas.width / ratio, canvas.height / ratio);
        }
        strokes.forEach((s) => {
          if (!s.length) return;
          ctx.beginPath();
          ctx.moveTo(s[0][0], s[0][1]);
          if (s.length === 1) ctx.lineTo(s[0][0], s[0][1]); // toque suelto: punto
          else for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
          ctx.stroke();
        });
      }
      // Tamaño en pantalla (px CSS) para el que está armada la imagen interna.
      // Si el recuadro cambia de tamaño y la imagen interna no, el navegador la
      // estira para llenarlo y la raya ya no sale debajo del dedo.
      let tamCss = { w: 0, h: 0 };
      function resize() {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // aún oculto, se reintentará al mostrarse
        const ratio = window.devicePixelRatio || 1;
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1f2a33';
        tamCss = { w: rect.width, h: rect.height };
      }
      resize();

      /**
       * Deja la imagen interna del tamaño exacto del recuadro, conservando lo
       * ya firmado. SÍNCRONO a propósito: se llama al tocar el lienzo, y si
       * restaurara la firma en diferido (como antes, con una imagen que carga
       * después) podía borrar el trazo que se acababa de empezar.
       * Los trazos están guardados como coordenadas, así que se reescalan a la
       * nueva medida sin perder calidad ni el historial de "deshacer".
       */
      function ajustarTamano(forzar) {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const igual = Math.abs(r.width - tamCss.w) < 0.5 && Math.abs(r.height - tamCss.h) < 0.5;
        if (igual && !forzar) return;
        if (tamCss.w && tamCss.h && !igual) {
          const sx = r.width / tamCss.w;
          const sy = r.height / tamCss.h;
          strokes = strokes.map((s) => s.map(([x, y]) => [x * sx, y * sy]));
        }
        resize();
        redibujar();
      }

      // Vigila el tamaño REAL del recuadro, no el evento de girar: cubre el
      // giro (que en muchos Android termina después de que el evento avisa),
      // una sección que se despliega, la barra de desplazamiento que aparece…
      if (typeof ResizeObserver !== 'undefined') {
        let espera = null;
        new ResizeObserver(() => {
          clearTimeout(espera);
          espera = setTimeout(() => { if (!drawing) ajustarTamano(false); }, 60);
        }).observe(canvas);
      }
      let drawing = false, hasInk = false, lastX = 0, lastY = 0;
      function pos(e) {
        const r = canvas.getBoundingClientRect();
        const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
        return [cx, cy];
      }
      function start(e) {
        if (canvas.dataset.locked === '1') return;
        e.preventDefault();
        // Antes de poner el primer punto se confirma que la imagen interna
        // coincide con el recuadro. Es la garantía final: pase lo que pase con
        // los giros, el trazo sale donde está el dedo.
        ajustarTamano(false);
        const [x, y] = pos(e);
        strokes.push([[x, y]]); // arranca un trazo nuevo
        drawing = true;
        [lastX, lastY] = [x, y];
      }
      function move(e) {
        if (!drawing || canvas.dataset.locked === '1') return;
        e.preventDefault();
        const [x, y] = pos(e);
        // Se dibuja el segmento de una vez (rápido) Y se guarda el punto, para
        // poder redibujar el trazo completo si luego se deshace otro.
        const actual = strokes[strokes.length - 1];
        if (actual) actual.push([x, y]);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        [lastX, lastY] = [x, y];
        hasInk = true;
        markSigned(canvas.id);
      }
      function end() { drawing = false; }
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);
      // Si el sistema interrumpe el toque (una llamada, un gesto del borde),
      // antes el lienzo se quedaba "dibujando" y el siguiente toque unía los
      // dos trazos con una raya recta.
      canvas.addEventListener('touchcancel', end);

      /* Exporta la firma a una resolución acotada.
         POR QUÉ: el lienzo en pantalla se crea a (ancho CSS × devicePixelRatio).
         En una tablet grande de alta densidad eso da un lienzo enorme, y el PNG
         resultante puede superar los 50.000 caracteres — que es el MÁXIMO que
         Google Sheets admite en una sola celda. El backend guarda cada firma en
         una celda (hoja "Firmas", columna C), así que al pasarse, esa escritura
         falla y la firma se pierde EN SILENCIO: la fila del permiso ya quedó
         guardada con los nombres, pero sin las imágenes. Ese era el motivo de
         que las firmas hechas desde el computador (≈18-49k) sí quedaran y las
         de la tablet (≈63-117k) no.
         Se reduce el tamaño hasta quedar cómodamente bajo el límite. Una firma
         es un trazo simple, así que bajar la resolución no afecta su lectura ni
         su validez como constancia. */
      function exportarFirmaAcotada() {
        const MAX_CARACTERES = 45000; // margen de seguridad bajo el tope de 50.000
        const ANCHO_OBJETIVO = 700;   // px reales; suficiente para un trazo nítido
        let escala = Math.min(1, ANCHO_OBJETIVO / (canvas.width || 1));
        let ultima = null;
        for (let intento = 0; intento < 6; intento++) {
          const w = Math.max(1, Math.round(canvas.width * escala));
          const h = Math.max(1, Math.round(canvas.height * escala));
          const tmp = document.createElement('canvas');
          tmp.width = w;
          tmp.height = h;
          const tctx = tmp.getContext('2d');
          tctx.drawImage(canvas, 0, 0, w, h);
          ultima = tmp.toDataURL('image/png');
          if (ultima.length <= MAX_CARACTERES) return ultima;
          escala *= 0.75; // todavía muy grande: se reduce otro poco y se reintenta
        }
        return ultima;
      }

      pads[canvas.id] = {
        clear: () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          strokes = [];
          baseImage = null;
          hasInk = false;
          markUnsigned(canvas.id);
        },
        undo: () => {
          // Quita el último trazo y redibuja el resto sobre la firma de fondo
          // (si el permiso traía una firma ya guardada, esa no se puede deshacer:
          // deshacer solo aplica a lo dibujado en esta sesión).
          strokes.pop();
          redibujar();
          if (!strokes.length && !baseImage) {
            hasInk = false;
            markUnsigned(canvas.id);
          }
        },
        getDataUrl: () => (hasInk ? exportarFirmaAcotada() : null),
        setDataUrl: (url) => {
          if (!url) return;
          hasInk = true;
          markSigned(canvas.id);
          const img = new Image();
          img.onload = () => {
            // Pasa a ser el fondo sobre el que se dibujan los trazos nuevos.
            baseImage = img;
            strokes = [];
            redibujar();
          };
          img.src = url;
        },
        hasInk: () => hasInk,
        /** Trazos de esta sesión, en px CSS, con la medida del lienzo donde se hicieron. */
        getStrokes: () => ({
          strokes: strokes.map((t) => t.map((pt) => [pt[0], pt[1]])),
          w: tamCss.w,
          h: tamCss.h,
          base: !!baseImage
        }),
        /**
         * Reemplaza lo firmado por estos trazos, ajustados a ESTE lienzo sin
         * deformarlos: se escala igual a lo ancho y a lo alto (una firma hecha
         * en pantalla completa horizontal no queda aplastada en un recuadro
         * vertical) y se centra. Nunca se agranda más allá del trazo original.
         */
        setStrokes: (lista) => {
          ajustarTamano(false);
          const pts = [];
          (lista || []).forEach((t) => t.forEach((pt) => pts.push(pt)));
          baseImage = null;
          if (!pts.length) {
            strokes = [];
            hasInk = false;
            redibujar();
            markUnsigned(canvas.id);
            return;
          }
          const xs = pts.map((pt) => pt[0]), ys = pts.map((pt) => pt[1]);
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
          const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);
          const margen = 10;
          const k = Math.min((tamCss.w - 2 * margen) / bw, (tamCss.h - 2 * margen) / bh, 1);
          const dx = (tamCss.w - bw * k) / 2 - minX * k;
          const dy = (tamCss.h - bh * k) / 2 - minY * k;
          strokes = lista.map((t) => t.map((pt) => [pt[0] * k + dx, pt[1] * k + dy]));
          hasInk = true;
          redibujar();
          markSigned(canvas.id);
        },
        // ⚠️ A diferencia de la versión anterior (donde solo el manejador de
        // rotación de pantalla preservaba la firma), refreshSize() SIEMPRE
        // guarda la firma actual antes de redimensionar y la vuelve a
        // dibujar después — fijar canvas.width/height limpia el bitmap, así
        // que sin esto, cualquier llamado a refreshIn() sobre un canvas ya
        // firmado borraría la firma en silencio (el estado seguiría
        // diciendo "Firmado ✓" pero el lienzo quedaría en blanco). Ahora es
        // seguro llamarlo en cualquier momento, sin importar el orden.
        // Usa la copia a resolución completa (no la recortada de getDataUrl),
        // para que girar la pantalla varias veces no degrade la firma.
        refreshSize: () => ajustarTamano(true)
      };
    }

    function refreshIn(container) {
      if (!container) return;
      container.querySelectorAll('canvas.pad, canvas.mini-pad').forEach((c) => {
        if (pads[c.id]) pads[c.id].refreshSize();
      });
    }

    /** Registra el reintento de tamaño al girar el celular (con espera para
     *  no recalcular a medio giro). Llamar una sola vez por manager. */
    function bindOrientationChange() {
      // Solo reajusta el tamaño de los lienzos al girar. Volver al recuadro
      // que se estaba firmando lo hace AnclaGiro (más abajo), que funciona
      // en todas las páginas aunque no tengan lienzos.
      let timer = null;
      window.addEventListener('orientationchange', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          Object.keys(pads).forEach((id) => pads[id].refreshSize());
        }, 120);
      });
    }

    return { pads, setup, refreshIn, bindOrientationChange };
  },
  /** Bloquea un lienzo (modo consulta / permiso ya cerrado) — no depende
   *  del manager, se puede llamar directo sobre el <canvas>. */
  lock(canvas) {
    canvas.dataset.locked = '1';
    canvas.classList.add('locked');
  }
};

/**
 * ScrollProgress: barra fina y fija arriba de la pantalla que muestra
 * cuánto lleva recorrido el usuario del formulario — información real
 * en un documento largo de 10 secciones diligenciado en celular, no
 * decoración. Color configurable por página (color de marca del permiso).
 */
const ScrollProgress = {
  init(color) {
    if (document.getElementById('scrollProgress')) return;
    const el = document.createElement('div');
    el.id = 'scrollProgress';
    if (color) el.style.setProperty('--progress-color', color);
    document.body.prepend(el);
    const update = () => {
      const h = document.documentElement;
      const scrollable = h.scrollHeight - h.clientHeight;
      const pct = scrollable > 0 ? (h.scrollTop / scrollable) * 100 : 0;
      el.style.width = Math.min(100, Math.max(0, pct)) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
};

const OfflineBanner = {
  init() {
    if (document.getElementById('offlineBanner')) return; // ya existe
    const el = document.createElement('div');
    el.id = 'offlineBanner';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = '⚠ Sin conexión — mostrando la última versión guardada. Los datos nuevos se guardarán cuando vuelva la señal.';
    document.body.prepend(el);
    const update = () => { el.style.display = navigator.onLine ? 'none' : 'block'; };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }
};

/**
 * SeleccionMultiple: fichas que se tocan para elegir varias opciones, con un
 * campo libre al final para lo que no esté en la lista.
 *
 * Reemplaza a los campos de texto donde había que escribir a mano cosas que
 * casi siempre son las mismas ("¿cuál permiso adicional?", "herramientas a
 * utilizar"): en obra, con guantes y de pie, escribir es lo más incómodo del
 * formulario. Además, al quedar los valores normalizados se pueden contar y
 * filtrar después, cosa imposible con texto libre.
 *
 * Se guarda como un solo texto separado por " · " para que lo que ya está
 * registrado en la hoja siga leyéndose igual y no haya que migrar nada.
 *
 *   const sel = SeleccionMultiple.crear(document.getElementById('x'), {
 *     opciones: ['Taladro','Pulidora'],
 *     placeholderLibre: 'Otras herramientas…'
 *   });
 *   sel.get();          // "Taladro · Pulidora · lo que se escribió"
 *   sel.set(texto);     // reconstruye la selección desde ese texto
 */
const SeleccionMultiple = {
  crear(contenedor, opts) {
    opts = opts || {};
    const opciones = opts.opciones || [];
    const seleccion = new Set();

    const fichas = document.createElement('div');
    fichas.className = 'sm-fichas';
    const libre = document.createElement('input');
    libre.type = 'text';
    libre.className = 'sm-libre';
    libre.placeholder = opts.placeholderLibre || 'Otro (escribe aquí)…';

    opciones.forEach((op) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sm-ficha';
      b.textContent = op;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        if (seleccion.has(op)) { seleccion.delete(op); b.classList.remove('on'); b.setAttribute('aria-pressed','false'); }
        else { seleccion.add(op); b.classList.add('on'); b.setAttribute('aria-pressed','true'); }
        if (opts.onChange) opts.onChange();
      });
      fichas.appendChild(b);
    });
    if (opts.onChange) libre.addEventListener('input', opts.onChange);

    contenedor.innerHTML = '';
    contenedor.appendChild(fichas);
    contenedor.appendChild(libre);

    return {
      get() {
        const partes = opciones.filter(o => seleccion.has(o));
        const extra = libre.value.trim();
        if (extra) partes.push(extra);
        return partes.join(' · ');
      },
      set(texto) {
        seleccion.clear();
        fichas.querySelectorAll('.sm-ficha').forEach(b => {
          b.classList.remove('on'); b.setAttribute('aria-pressed','false');
        });
        libre.value = '';
        if (!texto) return;
        // Lo que coincida con una opción se marca como ficha; el resto vuelve
        // al campo libre. Así un permiso guardado antes de este cambio, con
        // texto escrito a mano, se sigue viendo completo.
        const sueltos = [];
        String(texto).split('·').map(x => x.trim()).filter(Boolean).forEach(parte => {
          const op = opciones.find(o => o.toLowerCase() === parte.toLowerCase());
          if (op) { seleccion.add(op); }
          else sueltos.push(parte);
        });
        fichas.querySelectorAll('.sm-ficha').forEach(b => {
          if (seleccion.has(b.textContent)) { b.classList.add('on'); b.setAttribute('aria-pressed','true'); }
        });
        libre.value = sueltos.join(' · ');
      },
      vacio() { return !this.get(); }
    };
  }
};

/* ============================================================
 * AnclaGiro: al girar el celular, la pantalla vuelve sola a donde estaba.
 * ------------------------------------------------------------
 * Al pasar de vertical a horizontal (o al revés) el alto de toda la página
 * cambia y el navegador pierde la posición: quedas en otra parte del permiso
 * y toca buscar otra vez el recuadro de la firma.
 *
 * La versión anterior (v62) fallaba por tres motivos, y los tres se
 * reprodujeron en pruebas antes de corregir:
 *  1. Recordaba el último lienzo TOCADO: si alguien ya había firmado el
 *     recuadro de otro ejecutante, al girar mandaba a ese, lejos del actual.
 *  2. Si no se había tocado ninguno, se anclaba a una sección entera, y
 *     "centrar" una sección de 3 pantallas de alto deja cualquier cosa a la vista.
 *  3. Corregía a los 120 y 370 ms; en Android el giro puede terminar después
 *     y el navegador deshacía la corrección.
 *
 * Ahora:
 *  - Se recuerda lo que SE ESTÁ VIENDO, actualizado cada vez que la pantalla
 *    queda quieta: primero un recuadro de firma visible; si no hay, el campo
 *    más cercano al centro (nunca un bloque más alto que media pantalla).
 *  - El giro se detecta por la orientación real del aparato, no por el alto
 *    de la ventana: abrir el teclado encoge la ventana y no debe contar.
 *  - Se vuelve al punto varias veces durante 1,5 s mientras el giro termina
 *    de acomodarse, y se deja de insistir en cuanto la persona toca la pantalla.
 * ============================================================ */
const AnclaGiro = (() => {
  const SEL_FIRMA = 'canvas.pad, canvas.sigpad, canvas.mini-pad';
  const SEL_CAMPO = SEL_FIRMA + ', .field, .epp-item, .close-q, .check-item, .exec-card, h2, h3, .section-title';
  const REINTENTOS_MS = [0, 120, 300, 550, 900, 1500];
  let ancla = null;
  let ultimoTocado = null;
  let restaurando = false;
  let timers = [];
  let orientacion = null;
  let esperaScroll = null;

  function orientacionActual() {
    if (screen.orientation && screen.orientation.type) return screen.orientation.type.indexOf('portrait') === 0 ? 'v' : 'h';
    if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90 ? 'h' : 'v';
    return window.innerWidth > window.innerHeight ? 'h' : 'v';
  }
  function enPantalla(el) {
    if (!el || !document.body.contains(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }
  function masCercanoAlCentro(selector, altoMax) {
    const centro = window.innerHeight / 2;
    let mejor = null, mejorDist = Infinity;
    document.querySelectorAll(selector).forEach((el) => {
      if (!enPantalla(el)) return;
      const r = el.getBoundingClientRect();
      if (altoMax && r.height > altoMax) return;
      const d = Math.abs(r.top + r.height / 2 - centro);
      if (d < mejorDist) { mejorDist = d; mejor = el; }
    });
    return mejor;
  }
  function elegir() {
    // El recuadro que se acaba de tocar manda, pero SOLO si sigue a la vista:
    // si la persona bajó a otro ejecutante, ese ya no cuenta.
    if (enPantalla(ultimoTocado)) return ultimoTocado;
    return masCercanoAlCentro(SEL_FIRMA) || masCercanoAlCentro(SEL_CAMPO, window.innerHeight * 0.5);
  }
  function registrar() {
    if (restaurando) return;
    const el = elegir();
    if (el) ancla = el;
  }
  function detener() {
    timers.forEach(clearTimeout);
    timers = [];
    restaurando = false;
  }
  function alGirar() {
    const nueva = orientacionActual();
    if (nueva === orientacion && restaurando) return; // ya se está corrigiendo este giro
    orientacion = nueva;
    const objetivo = ancla;
    detener();
    if (!objetivo || !document.body.contains(objetivo)) return;
    restaurando = true;
    REINTENTOS_MS.forEach((ms, i) => {
      timers.push(setTimeout(() => {
        if (document.body.contains(objetivo)) objetivo.scrollIntoView({ block: 'center', behavior: 'auto' });
        if (i === REINTENTOS_MS.length - 1) {
          restaurando = false;
          registrar();
        }
      }, ms));
    });
  }

  function init() {
    orientacion = orientacionActual();
    registrar();
    // La posición se anota cuando la pantalla queda quieta. La espera también
    // protege contra el propio giro: el navegador mueve la página al empezar
    // a girar, y para cuando esta anotación se ejecutaría, ya se sabe que es
    // un giro y se ignora.
    window.addEventListener('scroll', () => {
      clearTimeout(esperaScroll);
      esperaScroll = setTimeout(registrar, 200);
    }, { passive: true });
    document.addEventListener('touchstart', (e) => {
      // Si la persona toca la pantalla mientras se corrige, manda ella.
      if (restaurando) detener();
      const c = e.target && e.target.closest ? e.target.closest(SEL_FIRMA) : null;
      if (c) { ultimoTocado = c; ancla = c; }
    }, { passive: true, capture: true });
    const revisar = () => { if (orientacionActual() !== orientacion) alGirar(); };
    window.addEventListener('orientationchange', alGirar);
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', revisar);
    window.addEventListener('resize', revisar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { _estado: () => ({ ancla, restaurando, orientacion }) };
})();

/* ============================================================
 * FirmaCompleta: en celular, la firma se hace a pantalla completa.
 * ------------------------------------------------------------
 * En un celular el recuadro de firma es angosto, y la solución de siempre
 * era girar el teléfono… con lo que la página entera se reacomodaba y había
 * que volver a buscar el recuadro. Llevamos varias versiones corrigiendo los
 * efectos del giro; esto ataca la causa: al tocar el recuadro se abre un
 * lienzo que ocupa toda la pantalla, sin nada detrás que se mueva. Se firma,
 * se toca "Listo", la firma pasa al recuadro y la pantalla queda ahí mismo.
 *
 * - Solo en celulares (pantalla táctil con el lado corto menor a 600 px). En
 *   tablet y computador el recuadro normal ya es cómodo y no cambia nada.
 * - La firma pasa como trazos, no como imagen: no pierde calidad ni se
 *   deforma, aunque se haya hecho en horizontal y el recuadro sea vertical.
 * - Si el recuadro ya traía una firma guardada, "Listo" sin dibujar la deja
 *   como estaba: no se puede borrar una firma sin querer.
 * - El botón "atrás" de Android cierra la firma en vez de salir del permiso.
 * ============================================================ */
const FirmaCompleta = (() => {
  const MQ = '(pointer: coarse) and (max-width: 599px), (pointer: coarse) and (max-height: 599px)';
  let el = null, pad = null, destino = null, destinoPad = null;
  let abierta = false, empujado = false, ignorarPop = false, teniaBase = false;

  function usar() {
    return !!(window.matchMedia && window.matchMedia(MQ).matches);
  }

  /** Nombre de quien firma, tomado del mismo bloque del recuadro. */
  function nombreFirmante(canvas) {
    const bloque = canvas.closest('.exec-card, tr, .sig-block, .sig-pad-wrap, .field, section') || canvas.parentElement;
    let b = bloque;
    // Sube hasta 3 niveles buscando un campo de nombre con algo escrito.
    for (let i = 0; i < 3 && b; i++, b = b.parentElement) {
      const inp = Array.from(b.querySelectorAll('input')).find((x) => /nombre/i.test(x.id + ' ' + x.name + ' ' + x.placeholder) && x.value.trim());
      if (inp) return inp.value.trim();
    }
    const t = bloque && bloque.querySelector('h5, h4, label, .exec-num');
    return t ? t.textContent.trim() : '';
  }
  function tituloBloque(canvas) {
    const bloque = canvas.closest('.exec-card, .sig-block, .sig-pad-wrap, .field') || canvas.parentElement;
    const card = canvas.closest('.exec-card');
    const t = (card && card.querySelector('.exec-num')) || (bloque && bloque.querySelector('h5, h4, label'));
    return t ? t.textContent.trim() : 'Firma';
  }

  function construir() {
    el = document.createElement('div');
    el.id = 'firmaCompleta';
    el.className = 'firma-completa';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Firmar a pantalla completa');
    el.innerHTML =
      '<div class="fc-cab">' +
        '<div class="fc-quien"><span class="fc-etq" id="fcTitulo">Firma</span><b id="fcNombre"></b></div>' +
        '<span class="fc-giro">💡 Gira el celular si quieres más espacio</span>' +
      '</div>' +
      '<div class="fc-aviso" id="fcAviso">Ya hay una firma guardada. Si firmas aquí, la reemplaza; si tocas Listo sin firmar, queda la que estaba.</div>' +
      '<div class="fc-area"><canvas id="fcPad" class="pad-completa" data-completa="1"></canvas><div class="fc-linea" aria-hidden="true"></div></div>' +
      '<div class="fc-pie">' +
        '<button type="button" data-fc="cancelar">Cancelar</button>' +
        '<button type="button" data-fc="deshacer">Deshacer</button>' +
        '<button type="button" data-fc="borrar">Borrar</button>' +
        '<button type="button" data-fc="listo" class="fc-listo">Listo ✓</button>' +
      '</div>';
    document.body.appendChild(el);
    const mgr = SignaturePad.createManager({ statusIdFor: () => '__fc_sin_estado' });
    const c = document.getElementById('fcPad');
    mgr.setup(c);
    pad = mgr.pads[c.id];
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-fc]');
      if (!b) return;
      const acc = b.dataset.fc;
      if (acc === 'borrar') pad.clear();
      else if (acc === 'deshacer') pad.undo();
      else if (acc === 'cancelar') cerrar(false);
      else if (acc === 'listo') cerrar(true);
    });
    window.addEventListener('popstate', () => {
      if (ignorarPop) { ignorarPop = false; return; }
      if (abierta) { empujado = false; cerrarInterno(false); }
    });
  }

  function abrir(canvas, padDestino) {
    if (!padDestino) return;
    if (!el) construir();
    destino = canvas;
    destinoPad = padDestino;
    const previo = padDestino.getStrokes ? padDestino.getStrokes() : { strokes: [], base: false };
    teniaBase = !!previo.base;
    document.getElementById('fcTitulo').textContent = tituloBloque(canvas);
    document.getElementById('fcNombre').textContent = nombreFirmante(canvas);
    document.getElementById('fcAviso').style.display = teniaBase ? 'block' : 'none';
    document.documentElement.classList.add('fc-abierta');
    el.classList.add('abierta');
    abierta = true;
    try { history.pushState({ firmaCompleta: true }, ''); empujado = true; } catch (e) { empujado = false; }
    // El lienzo mide 0×0 mientras está oculto: se ajusta ya visible.
    requestAnimationFrame(() => {
      pad.refreshSize();
      pad.clear();
      // Si en esta sesión ya se había firmado, se trae para poder corregirla.
      if (!teniaBase && previo.strokes && previo.strokes.length) pad.setStrokes(previo.strokes);
    });
  }

  function cerrarInterno(aceptar) {
    if (!abierta) return;
    if (aceptar) {
      const actual = pad.getStrokes();
      if (actual.strokes.length) destinoPad.setStrokes(actual.strokes);
      else if (!teniaBase) destinoPad.setStrokes([]); // borró todo y confirmó
      // El formulario guarda el borrador al detectar cambios dentro de él; el
      // lienzo grande está fuera, así que se avisa desde el recuadro original.
      destino.dispatchEvent(new Event('input', { bubbles: true }));
      destino.dispatchEvent(new Event('change', { bubbles: true }));
    }
    el.classList.remove('abierta');
    document.documentElement.classList.remove('fc-abierta');
    abierta = false;
    const volverA = destino;
    // Dos veces: si se giró el celular mientras se firmaba, la página detrás
    // cambió de medida y termina de acomodarse un momento después.
    requestAnimationFrame(() => {
      if (volverA && document.body.contains(volverA)) volverA.scrollIntoView({ block: 'center', behavior: 'auto' });
      setTimeout(() => { if (volverA && document.body.contains(volverA)) volverA.scrollIntoView({ block: 'center', behavior: 'auto' }); }, 300);
    });
  }

  function cerrar(aceptar) {
    cerrarInterno(aceptar);
    if (empujado) {
      empujado = false;
      ignorarPop = true;
      history.back();
    }
  }

  return { usar, abrir, cerrar, estaAbierta: () => abierta };
})();

/* ================= FESTIVOS DE COLOMBIA Y DÍAS HÁBILES =================
   Ley 51 de 1983 ("Emiliani") y Semana Santa. La misma cuenta está en
   backend-sgsst.gs, para que el celular y el correo digan el mismo plazo
   (reporte a la ARL: 2 días hábiles). */
const Festivos = {
  _cache: {},
  de(anio) {
    if (this._cache[anio]) return this._cache[anio];
    const iso = (d) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    const f = (m, d) => new Date(Date.UTC(anio, m - 1, d));
    const lunes = (d) => { const w = d.getUTCDay(); if (w !== 1) d.setUTCDate(d.getUTCDate() + ((8 - w) % 7)); return d; };
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, g = Math.floor((8 * b + 13) / 25);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 19 * l) / 433);
    const mes = Math.floor((h + l - 7 * m + 90) / 25), dia = (h + l - 7 * m + 33 * mes + 19) % 32;
    const pascua = f(mes, dia);
    const mas = (n) => { const x = new Date(pascua.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
    const set = {};
    [f(1, 1), f(5, 1), f(7, 20), f(8, 7), f(12, 8), f(12, 25), mas(-3), mas(-2),
      lunes(f(1, 6)), lunes(f(3, 19)), lunes(f(6, 29)), lunes(f(8, 15)), lunes(f(10, 12)), lunes(f(11, 1)), lunes(f(11, 11)),
      lunes(mas(39)), lunes(mas(60)), lunes(mas(68))].forEach((x) => { set[iso(x)] = true; });
    return (this._cache[anio] = set);
  },
  esHabil(iso) { const p = iso.split('-').map(Number); const w = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); return w !== 0 && w !== 6 && !this.de(p[0])[iso]; },
  sumarDias(iso, n) { const p = iso.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.toISOString().slice(0, 10); },
  sumarHabiles(iso, n) { let d = iso, k = 0; while (k < n) { d = this.sumarDias(d, 1); if (this.esHabil(d)) k++; } return d; },
  hoy() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); },
  sumarMeses(iso, n) { const p = iso.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1 + n, p[2])); if (d.getUTCDate() !== p[2]) d.setUTCDate(0); return d.toISOString().slice(0, 10); },
  corta(iso) { return /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : (iso || ''); }
};

/* ================= USUARIOS CON NOMBRE (SG-SST) =================
   Opcional: si el servidor SG-SST tiene usuarios, cada quien entra con su
   usuario y su clave. La clave NUNCA sale del celular: se deriva una "prueba"
   (PBKDF2, 150.000 vueltas) con la sal del usuario y eso es lo que viaja.
   La sesión dura 30 días en un equipo personal y 12 horas en uno compartido. */
const Sesion = {
  get KEY() { return Consola.clave('ssta-sesion'); },
  get KEY_MODO() { return Consola.clave('ssta-sgsst-usuarios'); },
  ITER: 150000,
  get() { try { const s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (s && s.token && s.exp > Date.now()) return s; } catch (e) {} return null; },
  token() { const s = this.get(); return s ? s.token : ''; },
  yo() { const s = this.get(); return s ? s.yo : null; },
  nombre() { const y = this.yo(); return y ? y.nombre : ''; },
  rol() { const y = this.yo(); return y ? y.rol : ''; },
  /** ¿El servidor usa usuarios? (lo dice cada lista que llega). */
  modo() { try { return localStorage.getItem(this.KEY_MODO) === '1'; } catch (e) { return false; } },
  _guardar(r) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ token: r.sesion, exp: r.exp, yo: r.yo })); localStorage.setItem(this.KEY_MODO, '1'); } catch (e) {}
    this.pintarChip();
  },
  /** Lo que dice el servidor en cada lista: si hay usuarios y quién soy (rol al día). */
  marcar(j) {
    if (!j || !j.ok) return;
    try {
      if (j.usuarios) localStorage.setItem(this.KEY_MODO, '1'); else localStorage.removeItem(this.KEY_MODO);
      const s = this.get();
      if (s && j.yo && j.yo.usuario === s.yo.usuario && JSON.stringify(j.yo) !== JSON.stringify(s.yo)) { s.yo = j.yo; localStorage.setItem(this.KEY, JSON.stringify(s)); this.pintarChip(); }
    } catch (e) {}
  },
  salir() { try { localStorage.removeItem(this.KEY); localStorage.removeItem('ssta-pendientes'); } catch (e) {} this.pintarChip(); },
  /** Usuario dentro de un token (sin validar: solo para decidir qué reenviar). */
  _carga(tok) { try { const p = String(tok || '').split('.')[1]; return JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; } },
  /** Para la cola: se reenvía con la sesión de ahora si es de la misma persona (o si la del
   *  registro venció o la rechazaron); la de otra persona, vigente, se respeta. */
  paraReenvio(tok, rechazada) {
    const c = this._carga(tok), yo = this.yo(), ahora = this.token();
    if (!ahora) return tok || '';
    if (rechazada || !c || !(c.exp > Date.now()) || (yo && c.u === yo.usuario)) return ahora;
    return tok;
  },
  /** El servidor no aceptó la sesión de este equipo (venció, la cerraron o cambió la clave). */
  rechazada() { if (this.get()) { try { localStorage.removeItem(this.KEY); } catch (e) {} this.pintarChip(); } },
  nuevaSal() { const a = crypto.getRandomValues(new Uint8Array(16)); return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); },
  async derivar(clave, salHex, iter) {
    const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(clave)), 'PBKDF2', false, ['deriveBits']);
    const sal = new Uint8Array(String(salHex).match(/../g).map((h) => parseInt(h, 16)));
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: Number(iter) || this.ITER }, llave, 256));
    let t = ''; bits.forEach((b) => { t += String.fromCharCode(b); }); return btoa(t);
  },
  claveDebil(c) { c = String(c || ''); return c.length < 8 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) || !/\d/.test(c); },
  async _post(body) {
    const res = await fetch(SGSST.url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: SGSST.token(), opId: SGSST.nuevoOpId() }, body)) });
    return SGSST._json(res);
  },
  async _sal(usuario) {
    const res = await fetchWithRetry(SGSST.url() + '?action=sal&usuario=' + encodeURIComponent(usuario) + '&token=' + encodeURIComponent(SGSST.token()));
    const j = await SGSST._json(res);
    if (!j.ok) throw new Error(j.error || 'No se pudo consultar el usuario.');
    return j;
  },
  async entrar(usuario, clave, compartido) {
    usuario = String(usuario || '').trim().toLowerCase();
    const s = await this._sal(usuario);
    const r = await this._post({ action: 'entrar', usuario, prueba: await this.derivar(clave, s.salt, s.iter), compartido: !!compartido });
    if (r.ok) this._guardar(r);
    return r;
  },
  /** Datos para crear o cambiar una clave: sal nueva + prueba (la clave no viaja). */
  async datosClave(clave) { const salt = this.nuevaSal(); return { salt, iter: this.ITER, pruebaNueva: await this.derivar(clave, salt, this.ITER) }; },
  _abierto: false,
  _css() {
    if (document.getElementById('sesionCss')) return;
    const st = document.createElement('style'); st.id = 'sesionCss';
    /* v111: mismo lenguaje del diseño nuevo (vidrio, esquinas grandes, botón degradado). */
    st.textContent = '.ses-chip{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:10px;z-index:60;background:#10213a;color:#fff;border:0;border-radius:999px;padding:7px 12px;font:700 13px/1.2 inherit;font-family:inherit;box-shadow:0 6px 16px rgba(16,33,58,.25);max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}' +
      '.ses-chip.sin{background:#ff9d2e;color:#3a2a00;}' +
      /* v107: en el inicio el botón va dentro de la fila de botones del encabezado (no tapa Estado ni Ayuda) */
      '.hdr-acc .ses-chip{position:static;max-width:30vw;min-height:44px;border-radius:22px;padding:0 14px;box-shadow:none;align-self:center;}' +
      '@media(max-width:520px){.hdr-acc .ses-chip{width:44px;min-height:44px;padding:0;font-size:18px;}.hdr-acc .ses-chip .ses-nom{display:none;}}' +
      '.ses-fondo{position:fixed;inset:0;background:rgba(10,18,34,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:20050;display:flex;align-items:flex-end;justify-content:center;}' +
      '.ses-caja{background:rgba(255,255,255,.96);color:#10213a;width:100%;max-width:440px;border-radius:30px 30px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(16,33,58,.25);max-height:92vh;overflow:auto;}' +
      '.ses-caja:before{content:"";display:block;width:44px;height:5px;border-radius:3px;background:#d3dce8;margin:-8px auto 14px;}' +
      '@media(min-width:600px){.ses-fondo{align-items:center}.ses-caja{border-radius:30px}.ses-caja:before{display:none}}' +
      '.ses-caja h3{margin:0 0 4px;font-size:21px;font-weight:800;letter-spacing:-.02em}.ses-caja p{margin:0 0 12px;font-size:14px;color:#5f7390;line-height:1.45;font-weight:500}' +
      '.ses-caja label{display:block;font-size:12px;font-weight:700;margin:12px 0 5px;color:#5f7390;text-transform:uppercase;letter-spacing:.05em}' +
      '.ses-caja input[type=text],.ses-caja input[type=password]{width:100%;box-sizing:border-box;border:1.5px solid transparent;background:#f1f5fa;border-radius:16px;padding:14px 16px;font-size:16px;font-weight:600;font-family:inherit;color:#10213a}' +
      '.ses-caja input[type=text]:focus,.ses-caja input[type=password]:focus{outline:none;background:#fff;border-color:#2f6bff;box-shadow:0 0 0 4px rgba(47,107,255,.15)}' +
      '.ses-caja .ses-check{display:flex;gap:10px;align-items:center;font-weight:600;font-size:13.5px;color:#10213a;text-transform:none;letter-spacing:0}' +
      '.ses-caja .ses-check input{width:20px;height:20px;accent-color:#2f6bff}' +
      '.ses-caja button{width:100%;border:0;border-radius:999px;padding:15px;font-size:15.5px;font-weight:800;margin-top:10px;cursor:pointer;font-family:inherit;min-height:52px}' +
      '.ses-caja .ses-si{background:linear-gradient(135deg,#2f6bff,#6a4cff);color:#fff;box-shadow:0 10px 24px rgba(47,107,255,.35)}.ses-caja .ses-no{background:#eef3f9;color:#10213a}' +
      '.ses-caja .ses-msg{min-height:18px;font-size:13px;color:#d92d20;margin-top:8px;font-weight:600}';
    document.head.appendChild(st);
  },
  _caja(html) {
    this._css();
    const f = document.createElement('div'); f.className = 'ses-fondo';
    f.innerHTML = '<div class="ses-caja" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(f);
    return { el: f.querySelector('.ses-caja'), cerrar: () => f.remove() };
  },
  /** Ventana para entrar. Se abre sola cuando el servidor pide usuario. */
  pedir(motivo) {
    if (this._abierto || typeof document === 'undefined' || !document.body || !SGSST.url()) return;
    this._abierto = true;
    const m = this._caja('<h3>Entrar al sistema de gestión</h3><p>' + esc(motivo || 'Cada cambio queda con el nombre de quien lo hizo. Entra con tu usuario y tu contraseña (te los da el área SST).') + '</p>' +
      '<label for="sesUsr">Usuario</label><input type="text" id="sesUsr" autocomplete="username" autocapitalize="none" spellcheck="false">' +
      '<label for="sesClave">Contraseña</label><input type="password" id="sesClave" autocomplete="current-password">' +
      '<label class="ses-check"><input type="checkbox" id="sesComp"> Equipo compartido (la sesión dura 12 horas)</label>' +
      '<button type="button" class="ses-si" id="sesEntrar">Entrar</button><button type="button" class="ses-no" id="sesNo">Ahora no</button><div class="ses-msg" id="sesMsg"></div>');
    const cerrar = () => { m.cerrar(); this._abierto = false; };
    const usr = m.el.querySelector('#sesUsr'), cl = m.el.querySelector('#sesClave'), msg = m.el.querySelector('#sesMsg'), b = m.el.querySelector('#sesEntrar');
    try { usr.value = localStorage.getItem(Consola.clave('ssta-ultimo-usuario')) || ''; } catch (e) {}
    // Empresa demo: usuarios ficticios para probar cada rol con un toque.
    const demo = typeof EMPRESA !== 'undefined' && EMPRESA.demo && EMPRESA.demoUsuarios;
    if (demo) {
      const d = document.createElement('div');
      d.innerHTML = '<p style="margin:14px 0 6px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;">Demo · entra como</p><div style="display:flex;flex-wrap:wrap;gap:8px;">' + EMPRESA.demoUsuarios.map((u, i) => '<button type="button" class="ses-no" data-demo="' + i + '" style="width:auto;margin:0;padding:9px 14px;min-height:40px;font-size:13.5px;font-weight:700;">' + esc(u[2]) + '</button>').join('') + '</div>';
      m.el.querySelector('#sesMsg').insertAdjacentElement('beforebegin', d);
      d.addEventListener('click', (e) => { const x = e.target.closest('[data-demo]'); if (!x) return; const u = EMPRESA.demoUsuarios[+x.dataset.demo]; usr.value = u[0]; cl.value = u[1]; ir(); });
    }
    m.el.querySelector('#sesNo').addEventListener('click', cerrar);
    const ir = async () => {
      if (!usr.value.trim() || !cl.value) { msg.textContent = 'Escribe el usuario y la clave.'; return; }
      b.disabled = true; msg.textContent = 'Comprobando…';
      try {
        const r = await this.entrar(usr.value, cl.value, m.el.querySelector('#sesComp').checked);
        if (!r.ok) { msg.textContent = r.error || 'No se pudo entrar.'; b.disabled = false; return; }
        try { localStorage.setItem(Consola.clave('ssta-ultimo-usuario'), usr.value.trim().toLowerCase()); } catch (e) {}
        cerrar();
        if (r.yo && r.yo.debeCambiar) this.cambiarClave(true);
        else this._despues();
      } catch (e) { msg.textContent = 'Sin conexión con el servidor: ' + e.message; b.disabled = false; }
    };
    b.addEventListener('click', ir);
    cl.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(); });
    setTimeout(() => (usr.value ? cl : usr).focus(), 60);
  },
  /** Después de entrar: lo pendiente sale; la página se recarga si no hay nada a medio escribir. */
  _despues() {
    try { if (typeof Outbox !== 'undefined') Outbox.flush(); } catch (e) {}
    if (document.querySelector('.modal-fondo')) { if (typeof UI !== 'undefined') UI.toast('✓ Entraste como ' + this.nombre() + '. Vuelve a guardar.'); }
    else location.reload();
  },
  cambiarClave(obligatorio) {
    const m = this._caja('<h3>🔑 ' + (obligatorio ? 'Crea tu clave' : 'Cambiar mi clave') + '</h3><p>' + (obligatorio ? 'Entraste con una clave temporal. Escribe una tuya: mínimo 8 caracteres, con letras y números. Nadie más la conoce (ni el administrador).' : 'Mínimo 8 caracteres, con letras y números. Al cambiarla se cierran tus sesiones en los demás equipos.') + '</p>' +
      '<label for="sesAct">Clave actual' + (obligatorio ? ' (la temporal)' : '') + '</label><input type="password" id="sesAct" autocomplete="current-password">' +
      '<label for="sesN1">Clave nueva</label><input type="password" id="sesN1" autocomplete="new-password">' +
      '<label for="sesN2">Repite la clave nueva</label><input type="password" id="sesN2" autocomplete="new-password">' +
      '<button type="button" class="ses-si" id="sesOk">Guardar mi clave</button>' + (obligatorio ? '' : '<button type="button" class="ses-no" id="sesNo">Cancelar</button>') + '<div class="ses-msg" id="sesMsg"></div>');
    const v = (id) => m.el.querySelector(id).value, msg = m.el.querySelector('#sesMsg'), b = m.el.querySelector('#sesOk');
    const no = m.el.querySelector('#sesNo'); if (no) no.addEventListener('click', m.cerrar);
    b.addEventListener('click', async () => {
      if (this.claveDebil(v('#sesN1'))) { msg.textContent = 'La clave nueva necesita mínimo 8 caracteres, con letras y números.'; return; }
      if (v('#sesN1') !== v('#sesN2')) { msg.textContent = 'Las dos claves nuevas no coinciden.'; return; }
      b.disabled = true; msg.textContent = 'Guardando…';
      try {
        const yo = this.yo(); const s = await this._sal(yo.usuario);
        const r = await this._post(Object.assign({ action: 'cambiarMiClave', sesion: this.token(), prueba: await this.derivar(v('#sesAct'), s.salt, s.iter) }, await this.datosClave(v('#sesN1'))));
        if (!r.ok) { msg.textContent = r.error || 'No se pudo cambiar.'; b.disabled = false; return; }
        this._guardar(r); m.cerrar();
        if (obligatorio) this._despues(); else if (typeof UI !== 'undefined') UI.toast('✓ Clave cambiada.');
      } catch (e) { msg.textContent = 'Sin conexión con el servidor: ' + e.message; b.disabled = false; }
    });
  },
  menu() {
    const yo = this.yo();
    if (!yo) { this.pedir(); return; }
    const ROL = { admin: 'Administrador', sst: 'SST', supervisor: 'Supervisor / campo', comite: 'Integrante de comité', consulta: 'Solo consulta' };
    const m = this._caja('<h3>👤 ' + esc(yo.nombre) + '</h3><p>Usuario <b>' + esc(yo.usuario) + '</b> · ' + esc(ROL[yo.rol] || yo.rol) + (yo.cargo ? ' · ' + esc(yo.cargo) : '') + '</p>' +
      (yo.rol === 'admin' ? '<button type="button" class="ses-no" id="sesUsuarios">👥 Usuarios y respaldo</button>' : '') +
      '<button type="button" class="ses-no" id="sesCambiar">🔑 Cambiar mi clave</button>' +
      '<button type="button" class="ses-no" id="sesSalir">Salir de este equipo</button><button type="button" class="ses-si" id="sesCerrar">Listo</button>');
    m.el.querySelector('#sesCerrar').addEventListener('click', m.cerrar);
    const u = m.el.querySelector('#sesUsuarios'); if (u) u.addEventListener('click', () => { location.href = 'usuarios.html'; });
    m.el.querySelector('#sesCambiar').addEventListener('click', () => { m.cerrar(); this.cambiarClave(false); });
    m.el.querySelector('#sesSalir').addEventListener('click', () => { m.cerrar(); this.salir(); location.reload(); });
  },
  /** Botón 👤 arriba a la derecha (solo si el servidor usa usuarios o hay sesión). */
  pintarChip() {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.body.classList.contains('consola')) return;   // la consola muestra quién entró en su encabezado
    let c = document.getElementById('sesChip');
    const yo = this.yo();
    if (!yo && !this.modo()) { if (c) c.remove(); return; }
    this._css();
    if (!c) { c = document.createElement('button'); c.type = 'button'; c.id = 'sesChip'; c.addEventListener('click', () => this.menu()); const acc = document.querySelector('.hdr-acc'); if (acc) acc.insertBefore(c, acc.firstChild); else document.body.appendChild(c); }
    c.className = 'ses-chip' + (yo ? '' : ' sin');
    c.innerHTML = '<span aria-hidden="true">👤</span><span class="ses-nom"> ' + esc(yo ? String(yo.nombre || yo.usuario).split(' ')[0] : 'Entrar') + '</span>';
    c.setAttribute('aria-label', yo ? 'Sesión de ' + yo.nombre : 'Entrar con mi usuario');
  },
  montarChip() {
    if (typeof document === 'undefined') return;
    if (document.body) this.pintarChip(); else document.addEventListener('DOMContentLoaded', () => this.pintarChip());
  }
};

/* ================= SERVIDOR SG-SST =================
   Personal habilitado, reportes, plan de acción, indicadores, equipos e
   inspecciones viven en un solo backend (backend-sgsst.gs). Aquí: listar
   (con copia en el equipo para ver sin señal), abrir un documento y enviar
   (si no hay señal, a la cola; se manda solo al volver). */
const SGSST = {
  url() { const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS && PORTAL_CONFIG.BACKENDS.sgsst) || {}; return B.url || ''; },
  token() { return (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.API_TOKEN) || ''; },
  nuevoId(prefijo) {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return prefijo + '-' + d.toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  },
  nuevoOpId() { return 'sg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); },
  _lsGet(k, def) { try { const v = localStorage.getItem(Consola.clave(k)); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  _lsSet(k, v) { try { localStorage.setItem(Consola.clave(k), JSON.stringify(v)); } catch (e) { /* memoria llena: no es grave */ } },
  async _json(res) {
    const t = await res.text();
    try { return JSON.parse(t); } catch (e) { const err = new Error(Outbox.describirPagina ? Outbox.describirPagina(t, res.status) : 'Respuesta no válida'); err.pagina = true; throw err; }
  },
  /** Lista de un tipo (o varios separados por coma). Sin señal devuelve la última copia. */
  async listar(tipos, opciones) {
    const clave = 'ssta-sgsst-lista:' + tipos;
    const copia = this._lsGet(clave, null);
    if (!this.url()) return { rows: (copia && copia.rows) || [], sinServidor: true };
    try {
      const res = await fetchWithRetry(this.url() + '?action=list&tipo=' + encodeURIComponent(tipos) + '&token=' + encodeURIComponent(this.token()) + this._ses());
      const j = await this._json(res);
      if (!j.ok && j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.marcar({ ok: true, usuarios: true }); Sesion.pintarChip(); if (!(opciones && opciones.sinPedir)) Sesion.pedir(j.error); return { rows: [], sinSesion: true, error: j.error }; }
      if (!j.ok) { const e = new Error(j.error || 'error del servidor'); e.json = j; throw e; }
      Sesion.marcar(j);
      const rows = j.rows.concat(this.pendientesLocales(tipos).filter((p) => !j.rows.some((r) => r.id === p.id)));
      this._lsSet(clave, { rows: j.rows, en: new Date().toISOString() });
      return { rows };
    } catch (e) {
      if (e.json && ClavePortal.esErrorDeClave(e.json)) ClavePortal.pedir();
      const rows = ((copia && copia.rows) || []).concat(this.pendientesLocales(tipos).filter((p) => !((copia && copia.rows) || []).some((r) => r.id === p.id)));
      return { rows, desdeCopia: true, copiaDel: copia && copia.en, error: e.message };
    }
  },
  async doc(id) {
    const local = this._lsGet('ssta-sgsst-doc:' + id, null);
    if (!this.url()) return local;
    try {
      const res = await fetchWithRetry(this.url() + '?action=doc&id=' + encodeURIComponent(id) + '&token=' + encodeURIComponent(this.token()) + this._ses());
      const j = await this._json(res);
      if (j.ok) { const d = Object.assign({}, j.doc, { version: j.version }); return d; }
      this.ultimoError = j.error || '';
      if (j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.pedir(j.error); return null; }
      if (j.codigoError === 'PERMISO') return null;
      return local;
    } catch (e) { return local; }
  },
  /* Lo enviado sin señal se muestra igual en las listas ("pendiente"). */
  pendientesLocales(tipos) {
    const p = this._lsGet('ssta-sgsst-pend', {}), t = String(tipos || '').split(',');
    return Object.keys(p).map((k) => p[k]).filter((x) => t.indexOf(x.tipo) !== -1);
  },
  /** Envía {action:'guardar'|'parche'|'borrar', tipo, id, …}. Devuelve {ok, enCola, …}.
   *  opciones.sinCola: si no hay conexión NO se guarda para después (p. ej. la
   *  clave del Comité de Convivencia: un cambio de clave atrasado sería peligroso). */
  _ses() { const t = Sesion.token(); return t ? '&sesion=' + encodeURIComponent(t) : ''; },
  /** GET con la clave del portal y la sesión (historial, adjuntos, usuarios…). */
  async consultar(params) {
    const q = Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
    const res = await fetchWithRetry(this.url() + '?' + q + '&token=' + encodeURIComponent(this.token()) + this._ses());
    const j = await this._json(res);
    if (!j.ok && j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.pedir(j.error); }
    return j;
  },
  async enviar(body, filaLocal, opciones) {
    body = Object.assign({ opId: this.nuevoOpId(), token: this.token(), sesion: Sesion.token() }, body);
    const encolar = async (motivo) => {
      if (opciones && opciones.sinCola) return { ok: false, error: 'Se necesita conexión (' + motivo + '). Inténtalo de nuevo con señal.', sinConexion: true };
      await Outbox.add(this.url(), body);
      if (filaLocal) { const p = this._lsGet('ssta-sgsst-pend', {}); p[body.id] = Object.assign({ id: body.id, tipo: body.tipo, pendiente: true }, filaLocal); this._lsSet('ssta-sgsst-pend', p); }
      return { ok: true, enCola: true, motivo };
    };
    if (!this.url()) return { ok: false, error: 'El servidor SG-SST no está configurado (config.js → BACKENDS.sgsst).' };
    if (!navigator.onLine) return encolar('sin señal');
    try {
      const res = await fetchWithRetry(this.url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      const j = await this._json(res);
      if (j.ok) return j;
      if (ClavePortal.esErrorDeClave(j)) { ClavePortal.pedir(); return { ok: false, error: j.error, clave: true }; }
      if (j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.marcar({ ok: true, usuarios: true }); Sesion.pedir(j.error); return j; }
      if (j.codigoError === 'CAMBIAR') { if (Sesion.yo()) Sesion.cambiarClave(true); return j; }
      if (Outbox._esTemporal(j)) return encolar('servidor ocupado');
      return j;
    } catch (e) {
      return encolar(e.pagina ? 'el servidor no respondió con datos' : 'sin conexión');
    }
  }
};
window.addEventListener('outbox-fallido', (ev) => {
  const b = ev.detail && ev.detail.item && ev.detail.item.body;
  if (!b || !b.id) return;
  const p = SGSST._lsGet('ssta-sgsst-pend', {});
  if (p[b.id]) { delete p[b.id]; SGSST._lsSet('ssta-sgsst-pend', p); }
});
window.addEventListener('outbox-enviado', (ev) => {
  const b = ev.detail && ev.detail.body;
  if (!b || !b.id) return;
  const p = SGSST._lsGet('ssta-sgsst-pend', {});
  if (p[b.id]) { delete p[b.id]; SGSST._lsSet('ssta-sgsst-pend', p); }
});

/* ================= PERSONAL HABILITADO =================
   Al escribir o traer la cédula de alguien en un permiso, el ATS o el anexo,
   aparece debajo si está habilitado: "✓ Habilitado", "⚠ Curso de alturas
   vencido el 12/08/2026", "Vence pronto…". Al guardar, si alguien no está
   habilitado, se pide confirmar y queda anotado en el registro.
   Los requisitos y lo que exige cada formato vienen de empresa.js. */
const Habilitacion = {
  CONFIG_FABRICA: {
    requisitos: {
      seguridad_social: { nombre: 'Pago de seguridad social (PILA)', meses: 1 },
      induccion: { nombre: 'Inducción / reinducción en SST', meses: 12 },
      medico: { nombre: 'Concepto médico ocupacional', meses: 12, apto: true },
      alturas: { nombre: 'Curso de trabajo en alturas', meses: 18 },
      confinados: { nombre: 'Curso de espacios confinados', meses: 12 },
      izajes: { nombre: 'Certificación de izaje (rigger / operador)', meses: 12 },
      electrico: { nombre: 'Competencia en riesgo eléctrico', meses: 12 },
      caliente: { nombre: 'Capacitación en trabajo en caliente', meses: 12 }
    },
    exigir: { todos: ['seguridad_social', 'induccion', 'medico'], alturas: ['alturas'], confinados: ['confinados'], izajes: ['izajes'], electrico: ['electrico'], caliente: ['caliente'] },
    avisarDias: 15
  },
  config() { const e = (typeof EMPRESA !== 'undefined' && EMPRESA.habilitacion) || {}; const f = this.CONFIG_FABRICA;
    return { requisitos: e.requisitos || f.requisitos, exigir: e.exigir || f.exigir, avisarDias: e.avisarDias || f.avisarDias }; },
  _mapa: null,
  _cargando: null,
  clave(c) { return String(c || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase(); },
  /** Mapa cédula → trabajador. Se guarda en el equipo para usarlo sin señal. */
  cargar(forzar) {
    if (this._mapa && !forzar) return Promise.resolve(this._mapa);
    if (this._cargando && !forzar) return this._cargando;
    const desdeCopia = SGSST._lsGet('ssta-habilitacion', null);
    if (desdeCopia && !this._mapa) this._mapa = desdeCopia.mapa;
    this._cargando = (async () => {
      if (!SGSST.url()) return this._mapa || {};
      // En segundo plano: sin usuario (p. ej. el preoperacional público) no pide entrar ni borra la copia.
      const r = await SGSST.listar('trabajador', { sinPedir: true });
      if (!r.desdeCopia && !r.sinSesion && !r.sinServidor) {
        const mapa = {};
        r.rows.forEach((x) => { const k = this.clave(x.resumen && x.resumen.cedula); if (k) mapa[k] = Object.assign({ id: x.id }, x.resumen); });
        this._mapa = mapa;
        SGSST._lsSet('ssta-habilitacion', { mapa, en: new Date().toISOString() });
      }
      return this._mapa || {};
    })();
    return this._cargando;
  },
  /** Requisitos que exige un contexto ("general", "alturas", "confinados"… o varios). */
  exigidos(contexto) {
    const ex = this.config().exigir, set = [];
    (ex.todos || []).forEach((k) => { if (set.indexOf(k) === -1) set.push(k); });
    [].concat(contexto || []).forEach((c) => (ex[c] || []).forEach((k) => { if (set.indexOf(k) === -1) set.push(k); }));
    return set;
  },
  /** {estado: 'ok'|'pronto'|'mal'|'sin-registro'|'sin-datos', problemas:[], avisos:[]} */
  revisar(cedula, contexto) {
    const k = this.clave(cedula);
    if (!k) return { estado: 'sin-datos', problemas: [], avisos: [] };
    const mapa = this._mapa || {};
    if (!Object.keys(mapa).length) return { estado: 'sin-datos', problemas: [], avisos: [] };   // el módulo aún no se usa
    const t = mapa[k];
    if (!t) return { estado: 'sin-registro', problemas: ['No está en Personal habilitado'], avisos: [] };
    if (t.activo === false) return { estado: 'mal', problemas: ['Está marcado como inactivo en Personal habilitado'], avisos: [], trabajador: t };
    const cfg = this.config(), hoy = Festivos.hoy(), pronto = Festivos.sumarDias(hoy, cfg.avisarDias);
    const problemas = [], avisos = [];
    this.exigidos(contexto).forEach((req) => {
      const def = cfg.requisitos[req] || { nombre: req }, r = (t.req || {})[req];
      if (!r || (!r.fecha && !r.vence)) { problemas.push('Sin ' + def.nombre.charAt(0).toLowerCase() + def.nombre.slice(1)); return; }
      if (def.apto && /no apto|aplazado/i.test(r.apto || '')) { problemas.push(def.nombre + ': ' + String(r.apto).toUpperCase()); return; }
      if (r.vence && r.vence < hoy) { problemas.push(def.nombre + ' vencido el ' + Festivos.corta(r.vence)); return; }
      if (r.vence && r.vence <= pronto) avisos.push(def.nombre + ' vence el ' + Festivos.corta(r.vence));
      // Las restricciones (dato de salud) solo se ven en la ficha de la persona.
      if (def.apto && /restricci/i.test(r.apto || '')) avisos.push('Apto con restricciones (ver su ficha)');
    });
    return { estado: problemas.length ? 'mal' : (avisos.length ? 'pronto' : 'ok'), problemas, avisos, trabajador: t };
  },
  _pintar(input, contexto) {
    const r = this.revisar(input.value, typeof contexto === 'function' ? contexto() : contexto);
    const cont = input.closest('.exec-fields, .grid2, .field, .fila-campos') || input;
    let el = cont.nextElementSibling && cont.nextElementSibling.classList && cont.nextElementSibling.classList.contains('hab-aviso') ? cont.nextElementSibling : null;
    if (r.estado === 'sin-datos') { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'hab-aviso'; cont.insertAdjacentElement('afterend', el); }
    el.dataset.estado = r.estado;
    el.textContent = r.estado === 'ok' ? '✓ Habilitado' : r.estado === 'pronto' ? '⏳ ' + r.avisos.join(' · ') : '⚠ ' + r.problemas.concat(r.avisos).join(' · ');
  },
  /** Pone el aviso debajo de cada campo de cédula que coincida (también los que se llenan solos). */
  vigilar(raiz, selector, contexto) {
    if (!SGSST.url()) return;
    const vistos = new WeakMap();
    const revisarTodo = () => {
      (raiz || document).querySelectorAll(selector).forEach((inp) => {
        const v = inp.value + '|' + (this._mapa ? 1 : 0) + '|' + JSON.stringify(typeof contexto === 'function' ? contexto() : contexto);
        if (vistos.get(inp) === v) return;
        vistos.set(inp, v);
        this._pintar(inp, contexto);
      });
    };
    this.cargar().then(revisarTodo).catch(() => {});
    setInterval(revisarTodo, 1200);
  },
  /** Para guardar: lista de personas con problemas en esa zona. */
  problemasEn(raiz, selector, contexto, nombreDe) {
    const out = [];
    (raiz || document).querySelectorAll(selector).forEach((inp) => {
      if (!inp.value.trim()) return;
      const r = this.revisar(inp.value, typeof contexto === 'function' ? contexto() : contexto);
      if (r.estado === 'mal' || r.estado === 'sin-registro') out.push({ cedula: inp.value.trim(), nombre: (nombreDe && nombreDe(inp)) || (r.trabajador && r.trabajador.nombre) || '', problemas: r.problemas });
    });
    return out;
  },
  /** Pide confirmar si hay personas no habilitadas. Devuelve null si se cancela, o la lista (para dejarla anotada). */
  confirmar(lista, anotar) {
    if (!lista.length) return [];
    const txt = 'Estas personas NO están habilitadas según Personal habilitado:\n\n' +
      lista.slice(0, 8).map((p) => '• ' + (p.nombre || 'C.C. ' + p.cedula) + ': ' + p.problemas.join('; ')).join('\n') + (lista.length > 8 ? '\n…y ' + (lista.length - 8) + ' más' : '') +
      '\n\n¿Guardar de todas formas?' + (anotar === false ? '' : ' Quedará anotado en el registro.');
    if (!confirm(txt)) return null;
    return lista.map((p) => Object.assign({ en: new Date().toISOString() }, p));
  }
};

/* ================= SISTEMA DE GESTIÓN POR ROL (v106) =================
   Lo de campo (permisos, ATS, charlas, preoperacionales, reportar) lo abre
   cualquiera. Los módulos del sistema de gestión, cuando el servidor usa
   usuarios, piden entrar y muestran solo lo que el rol permite (la tabla está
   en empresa.js: Empresa.accesoRol). Los datos sensibles los sigue cuidando
   el servidor (salud solo para Administrador y SST, quejas cifradas). */
const AccesoRol = {
  ROLES: { admin: 'Administrador', sst: 'SST', supervisor: 'Supervisor / campo', comite: 'Integrante de comité', consulta: 'Solo consulta' },
  modulo() {
    if (typeof Empresa === 'undefined' || !Empresa.moduloDeHref) return null;
    return Empresa.moduloDeHref(location.pathname.split('/').pop() || 'index.html');
  },
  /** null = puede entrar; 'entrar' = falta su usuario; 'rol' = su rol no tiene acceso. */
  revisar() {
    const m = this.modulo();
    if (!m || Empresa.esPublico(m) || typeof Sesion === 'undefined' || !Sesion.modo()) return null;
    const yo = Sesion.yo();
    if (!yo) return 'entrar';
    return Empresa.accesoRol(m, yo.rol) ? null : 'rol';
  },
  vigilar() {
    const r = this.revisar();
    if (!r) { this._preguntar(); return; }
    if (document.getElementById('accesoRol')) return;
    const yo = Sesion.yo(), d = document.createElement('div');
    d.id = 'accesoRol'; d.className = 'acceso-rol';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'arTit');
    d.innerHTML = '<div class="ar-caja"><span class="ar-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
      '<div class="ar-sup">Sistema de gestión</div>' +
      (r === 'entrar'
        ? '<h2 id="arTit">Entra con tu usuario</h2><p>Esta parte del portal pide usuario y contraseña. Sin usuario solo se hacen los <b>preoperacionales</b> y los <b>reportes</b>.</p>' +
          '<button type="button" id="arEntrar" class="ar-si">Entrar</button>'
        : '<h2 id="arTit">Tu usuario no tiene acceso aquí</h2><p>Entraste como <b>' + esc(yo.nombre) + '</b> (' + esc(this.ROLES[yo.rol] || yo.rol) + '). Si necesitas este módulo, pídeselo al administrador del portal.</p>') +
      '<a href="index.html" class="ar-no">Volver al inicio</a></div>';
    document.body.appendChild(d);
    const b = document.getElementById('arEntrar');
    if (b) b.addEventListener('click', () => Sesion.pedir('Entra con tu usuario para abrir este módulo del sistema de gestión.'));
    // Al entrar con un rol que sí lo ve, se quita el aviso sin recargar.
    if (!this._esperando) { this._esperando = true; const t = setInterval(() => { if (!this.revisar()) { clearInterval(t); this._esperando = false; const x = document.getElementById('accesoRol'); if (x) x.remove(); } }, 800); }
  },
  /** v111: en un celular que nunca habló con el servidor no se sabe si hay usuarios.
   *  Si la página es del sistema de gestión, se pregunta (sin clave ni sesión) y se vuelve a revisar. */
  _preguntar() {
    const m = this.modulo();
    if (this._pregunto || !m || Empresa.esPublico(m) || typeof Sesion === 'undefined' || Sesion.modo() || Sesion.yo()) return;
    if (typeof SGSST === 'undefined' || !SGSST.url() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    this._pregunto = true;
    fetchWithRetry(SGSST.url() + '?action=ping&token=' + encodeURIComponent(SGSST.token())).then((res) => res.json()).then((j) => {
      if (j && j.ok) { Sesion.marcar(j); this.vigilar(); }
    }).catch(() => {});
  }
};
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => AccesoRol.vigilar()); else AccesoRol.vigilar();
}

/* ================= SUBIR ARRIBA (v107) =================
   En las páginas largas (plan anual, matriz, PESV…) aparece abajo a la
   izquierda un botón para volver al inicio de la página de un toque. */
(function () {
  if (typeof document === 'undefined') return;
  const montar = () => {
    if (document.getElementById('subirArriba')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'subirArriba'; b.className = 'subir-arriba'; b.hidden = true;
    b.setAttribute('aria-label', 'Subir al inicio de la página'); b.title = 'Subir';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5l-7 7m7-7l7 7M12 5v14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener('click', () => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } });
    document.body.appendChild(b);
    const barra = document.querySelector('.footer-actions');
    if (barra && getComputedStyle(barra).position === 'fixed') b.classList.add('con-barra');
    // v109: solo aparece cuando la persona SUBE la página con el dedo (intención de volver
    // arriba) y se esconde al bajar, a los 2,5 s sin moverse o al tocar un campo. Así no
    // queda encima de las opciones (Sí / No / N.A.) ni se toca sin querer al marcar algo.
    let t = 0, yAnt = window.scrollY || 0, subida = 0, esconder = 0;
    const ocultar = () => { b.hidden = true; subida = 0; };
    const ver = () => {
      t = 0; const y = window.scrollY || document.documentElement.scrollTop, dy = y - yAnt; yAnt = y;
      if (y < 900 || dy > 0) { subida = 0; b.hidden = true; return; }
      subida += -dy; if (subida > 160) b.hidden = false;
      clearTimeout(esconder); esconder = setTimeout(ocultar, 2500);
    };
    window.addEventListener('scroll', () => { if (!t) t = requestAnimationFrame(ver); }, { passive: true });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#subirArriba')) ocultar(); }, { passive: true, capture: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();


/* ================= ICONOS Y SEÑALES (v112) =================
   Iconos de línea (en lugar de emojis) y señales ISO 7010 para cada tipo de
   permiso, el ATS y lo demás de la obra. Iconos.senal('alturas') devuelve el HTML. */
const Iconos = (function () {
  const P = {
    llama: 'M12 3c.8 3 4.2 4.6 4.2 8.3a4.2 4.2 0 0 1-8.4 0c0-1.6.6-2.7 1.6-3.7.2 1.2.9 1.8 1.6 1.9C11 8 11.6 5.6 12 3z',
    escalera: 'M8 3v18M16 3v18M8 7.5h8M8 12h8M8 16.5h8',
    tanque: 'M6 6c0-1.7 2.7-3 6-3s6 1.3 6 3v12c0 1.7-2.7 3-6 3s-6-1.3-6-3zM6 6c0 1.7 2.7 3 6 3s6-1.3 6-3M10 13h4',
    grua: 'M4 21h16M7 21V7M7 7h12M19 7v6M17 13h4M7 11l5-4',
    rayo: 'M13 3L5 13h6l-1 8 8-10h-6z',
    brujula: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
    escudo: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4',
    personas: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 5.2a3.5 3.5 0 0 1 0 6.6',
    mas: 'M12 5v14M5 12h14',
    repetir: 'M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4',
    candado: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
    cerrar: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12.5l2.5 2.5 4.5-5',
    lista: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    carpeta: 'M3 6h6l2 2h10v11H3z',
    reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    alerta: 'M12 4l9 16H3zM12 10v4M12 17.3v.01',
    flecha: 'M9 6l6 6-6 6'
  };
  // Tipo → [icono, forma ISO]. tri = advertencia, circ = obligación, cuad = seguridad.
  const TIPO = { caliente: ['llama', 'tri'], alturas: ['escalera', 'circ'], confinados: ['tanque', 'tri'], izajes: ['grua', 'tri'], electrico: ['rayo', 'tri'],
    ats: ['brujula', 'cuad'], epp: ['escudo', 'circ'], personal: ['personas', 'violeta'], asistencia: ['personas', 'circ'],
    cerrar: ['cerrar', 'cuad'], agregar: ['personas', 'violeta'], tablero: ['lista', 'circ'], repetir: ['repetir', 'naranja'] };
  const svg = (n) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (P[n] || P.alerta) + '"/></svg>';
  /** Clave del tipo a partir de un nombre o archivo: 'Trabajo en Alturas', 'permiso-trabajo-alturas.html'… */
  function tipoDe(x) {
    const s = String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/calient/.test(s)) return 'caliente'; if (/altur/.test(s)) return 'alturas'; if (/confin/.test(s)) return 'confinados';
    if (/izaj/.test(s)) return 'izajes'; if (/electr/.test(s)) return 'electrico'; if (/\bats\b|ats\.html|analisis de trabajo/.test(s)) return 'ats';
    if (/epp/.test(s)) return 'epp'; if (/personal/.test(s)) return 'personal'; if (/asist|charla/.test(s)) return 'asistencia';
    return '';
  }
  function senal(tipo, tam) {
    const t = TIPO[tipoDe(tipo) || tipo] || ['alerta', 'tri'];
    return '<span class="sg-iso ' + t[1] + (tam ? ' ' + tam : '') + '" aria-hidden="true">' + svg(t[0]) + '</span>';
  }
  // Las pantallas marcan dónde va una señal con data-senal="alturas" (antes había un emoji).
  function pintar(raiz) { (raiz || document).querySelectorAll('[data-senal]:empty').forEach((el) => { el.innerHTML = senal(el.dataset.senal, 'grande'); }); }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => pintar()); else pintar(); }
  return { svg, senal, tipoDe, pintar, P };
})();


/* ================= BARRA INFERIOR (v112) =================
   Barra flotante de vidrio con Inicio · Permisos · Gestión · Ayuda, para quien
   entró con su usuario (sin usuario solo hay preoperacional y reportes: no la
   necesita). No sale en las pantallas que ya tienen abajo su propia barra
   (Guardar, Enviar…), para no tapar nada, ni al imprimir. */
const BarraInferior = (function () {
  if (typeof document === 'undefined') return null;
  if (Consola.activa()) return null;   // v115: la consola del administrador no lleva la barra de los clientes
  const ITEMS = [
    { id: 'inicio', href: 'index.html', txt: 'Inicio', d: 'M4 11l8-7 8 7M6 10v10h12V10' },
    { id: 'permisos', href: 'dashboard.html', txt: 'Permisos', d: 'M9 4h6v3H9zM7 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M9 14l2 2 4-4' },
    { id: 'gestion', href: 'index.html#sg', txt: 'Gestión', d: 'M5 20V10M12 20V4M19 20v-7' },
    { id: 'ayuda', href: 'ayuda.html', txt: 'Ayuda', d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 17v.01' }
  ];
  const pagina = () => (location.pathname.split('/').pop() || 'index.html');
  function activo() {
    const p = pagina();
    if (p === 'dashboard.html' || /^permiso-/.test(p)) return 'permisos';
    if (p === 'ayuda.html') return 'ayuda';
    if (p === 'index.html') return location.hash === '#sg' ? 'gestion' : 'inicio';
    return 'gestion';
  }
  function hayOtraBarra(nav) {
    // Algo fijo abajo (barra de guardar, cola de pendientes, aviso…) que la barra taparía.
    const vistos = document.querySelectorAll('.footer-actions, .barra-guardar, #pendingNav.show, .fixed-bottom, .acciones-fijas, [data-barra-abajo]');
    for (const el of vistos) { if (el === nav || nav.contains(el)) continue; const cs = getComputedStyle(el); if ((cs.position === 'fixed' || cs.position === 'sticky') && cs.display !== 'none' && el.getBoundingClientRect().height > 20 && el.getBoundingClientRect().top < innerHeight) return true; }
    return false;
  }
  let nav = null;
  function montar() {
    if (nav || document.getElementById('barraInferior')) return;
    const yo = typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo();
    if (!yo || !document.body || document.body.dataset.sinBarra !== undefined) return;
    nav = document.createElement('nav');
    nav.id = 'barraInferior'; nav.className = 'barra-inferior'; nav.setAttribute('aria-label', 'Navegación principal');
    const a = activo();
    // v123: sin permisos de trabajo contratados, la barra no los muestra.
    const hayPermisos = typeof Empresa === 'undefined' || !Empresa.moduloActivo || ['caliente', 'alturas', 'confinados', 'izajes', 'electrico'].some((m) => Empresa.moduloActivo(m));
    nav.innerHTML = ITEMS.filter((x) => x.id !== 'permisos' || hayPermisos).map((x) => '<a href="' + x.href + '" data-id="' + x.id + '"' + (x.id === a ? ' class="on" aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + x.d + '"/></svg><span>' + x.txt + '</span></a>').join('');
    document.body.appendChild(nav);
    // En el inicio, «Gestión» lleva al sistema de gestión sin recargar.
    nav.querySelector('[data-id="gestion"]').addEventListener('click', (e) => {
      const sg = pagina() === 'index.html' && document.getElementById('sg');
      if (sg) { e.preventDefault(); if (location.hash !== '#sg') location.hash = 'sg'; marcar('gestion'); }   // v117: el inicio cambia a la vista del sistema de gestión
    });
    nav.querySelector('[data-id="inicio"]').addEventListener('click', (e) => {
      if (pagina() === 'index.html') { e.preventDefault(); history.replaceState(null, '', location.pathname); window.scrollTo({ top: 0, behavior: 'smooth' }); marcar('inicio'); }
    });
    const revisar = () => { const otra = hayOtraBarra(nav); nav.hidden = otra; document.body.classList.toggle('con-barra-inferior', !otra); };
    revisar(); setInterval(revisar, 1200);
  }
  function marcar(id) { if (!nav) return; nav.querySelectorAll('a').forEach((x) => { const on = x.dataset.id === id; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else setTimeout(montar, 0);
  return { montar, marcar };
})();

/* ================= «ATRÁS» VUELVE A DONDE ESTABAS (v123) =================
   Muchas pantallas tienen varias vistas dentro de la misma página (lista → formulario
   → detalle) y ventanas. El botón «atrás» del celular sacaba de la página y llevaba al
   inicio. Ahora cada vista y cada ventana deja su paso en el historial: «atrás» cierra
   la ventana o vuelve a la vista anterior, y solo al final sale de la página. */
const NavAtras = (function () {
  if (typeof window === 'undefined' || typeof history === 'undefined' || typeof document === 'undefined') return null;
  let ignorar = 0, modalesEmpujados = 0;
  const activa = () => document.querySelector('.screen.active');
  const primera = () => document.querySelector('.screen');
  const firmaAbierta = () => { try { return typeof FirmaCompleta !== 'undefined' && FirmaCompleta.estaAbierta(); } catch (e) { return false; } };
  function atrasSilencioso() { ignorar++; history.back(); }
  function alCambiarPantalla() {
    const a = activa(), ini = primera(); if (!a || !ini) return;
    const st = history.state || {};
    if (a === ini) { if (st.__p) atrasSilencioso(); return; }   // volvió con su propio botón: se quita el paso que sobraba
    if (st.__p !== a.id) history.pushState({ __p: a.id }, '');
  }
  function iniciar() {
    const pantallas = document.querySelectorAll('.screen');
    if (pantallas.length > 1) {
      const obs = new MutationObserver(() => setTimeout(alCambiarPantalla, 0));
      pantallas.forEach((s) => obs.observe(s, { attributes: true, attributeFilter: ['class'] }));
    }
    // Ventanas (UI.modal): «atrás» las cierra.
    new MutationObserver((ms) => ms.forEach((m) => {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains('modal-fondo')) {
        modalesEmpujados++;
        // Una ventana que reemplaza a otra recién cerrada reutiliza su paso (no se apilan).
        if (history.state && history.state.__m && document.querySelectorAll('body > .modal-fondo').length === 1) history.replaceState(Object.assign({}, history.state, { __m: modalesEmpujados }), '');
        else history.pushState(Object.assign({}, history.state || {}, { __m: modalesEmpujados }), '');
      } });
      m.removedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains('modal-fondo') && n.__porAtras !== true) setTimeout(() => {
        if (!document.querySelector('body > .modal-fondo') && history.state && history.state.__m) atrasSilencioso();
      }, 60); });
    })).observe(document.body, { childList: true });
  }
  window.addEventListener('popstate', (e) => {
    if (ignorar) { ignorar--; return; }
    if (firmaAbierta()) return;
    const fondos = document.querySelectorAll('body > .modal-fondo');
    if (fondos.length) { const f = fondos[fondos.length - 1]; f.__porAtras = true; const c = f.querySelector('[data-cerrar]'); if (c) c.click(); else f.remove(); return; }
    const a = activa(), ini = primera(); if (!a || !ini || a === ini) return;
    const st = e.state || {};
    if (st.__p === a.id) return;
    const destino = st.__p && document.getElementById(st.__p);
    if (destino && destino.classList.contains('screen')) { a.classList.remove('active'); destino.classList.add('active'); window.scrollTo(0, 0); return; }
    // A la primera vista: con su botón «volver» (recarga la lista) o, si no tiene, directo.
    const v = a.querySelector('[data-volver]');
    if (v) v.click(); else { a.classList.remove('active'); ini.classList.add('active'); window.scrollTo(0, 0); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  return { activa };
})();
