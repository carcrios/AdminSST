/* ============================================================
   menus-empresa.js — Qué ve cada empresa en sus menús (v124)
   Lo usan la consola del administrador (botón «Menús» de cada empresa) y el
   configurador. Tres partes:
     · Módulos, por categoría (lo que sale en Gestión, en la barra de abajo y lo
       que el servidor acepta) → config.modulos
     · Preoperacionales que se ofrecen          → config.ocultos.preop
     · Listas de inspección que se ofrecen      → config.ocultos.inspecciones
   Lo apagado no se borra: los registros viejos se siguen viendo.
   ============================================================ */
const MenusEmpresa = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const limpio = (t) => String(t || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();   // sin el emoji del catálogo
  const CHEV = '<svg class="me-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function preops() {
    const p = typeof PREOP_FORMULARIOS !== 'undefined' ? PREOP_FORMULARIOS : [], b = typeof PREOP_BASE !== 'undefined' ? PREOP_BASE : [];
    return p.concat(b.filter((x) => !p.some((f) => f.id === x.id || (f.codigo && f.codigo === x.codigo))))
      .filter((f) => !f.salud).map((f) => ({ id: f.id, t: f.nombre, g: f.grupo || 'Otros', c: f.codigo || '' }));
  }
  function inspecciones() {
    return (typeof PLANTILLAS_INSPECCION !== 'undefined' ? PLANTILLAS_INSPECCION : []).map((p) => ({ id: p.id, t: p.nombre, g: p.equipo ? 'De equipos' : 'De áreas y puestos', c: p.codigo || '' }));
  }
  function modulos() {
    const cat = typeof CATALOGO_MODULOS !== 'undefined' ? CATALOGO_MODULOS : [], nom = {};
    cat.forEach(([k, t]) => { nom[k] = limpio(t); });
    const cats = typeof CATEGORIAS_MODULOS !== 'undefined' ? CATEGORIAS_MODULOS : [];
    const en = [].concat.apply([], cats.map((c) => c[3]));
    const out = [];
    cats.forEach(([, n, , ks]) => ks.forEach((k) => { if (nom[k] && k !== 'asesor') out.push({ id: k, t: nom[k], g: n, c: '' }); }));
    cat.forEach(([k]) => { if (en.indexOf(k) === -1 && k !== 'asesor') out.push({ id: k, t: nom[k], g: 'Otros', c: '' }); });
    return out;
  }

  function grupo(tipo, g, items, apagado) {
    const on = items.filter((x) => !apagado(x.id)).length;
    return '<details class="me-g"><summary><span class="me-gt">' + esc(g) + '</span><span class="me-n" data-n>' + on + ' de ' + items.length + '</span>' +
      '<button type="button" class="me-todos" data-todos>' + (on === items.length ? 'Ninguno' : 'Todos') + '</button>' + CHEV + '</summary><div class="me-items">' +
      items.map((x) => '<label class="me-it"><input type="checkbox" data-me="' + tipo + '" data-id="' + esc(x.id) + '"' + (apagado(x.id) ? '' : ' checked') + '><span>' + esc(x.t) + (x.c ? '<small>' + esc(x.c) + '</small>' : '') + '</span></label>').join('') + '</div></details>';
  }
  function seccion(tipo, titulo, ayuda, items, apagado) {
    if (!items.length) return '';
    const gs = []; items.forEach((x) => { if (gs.indexOf(x.g) === -1) gs.push(x.g); });
    return '<section class="me-sec" data-sec="' + tipo + '"><h4>' + esc(titulo) + '</h4><p class="me-ayuda">' + esc(ayuda) + '</p>' +
      gs.map((g) => grupo(tipo, g, items.filter((x) => x.g === g), apagado)).join('') + '</section>';
  }

  /** HTML de las tres partes, según la configuración de la empresa (config.modulos y config.ocultos). */
  function html(config, opciones) {
    config = config || {}; opciones = opciones || {};
    const mods = config.modulos || {}, o = config.ocultos || {};
    const en = (l) => (id) => Array.isArray(o[l]) && o[l].indexOf(id) !== -1;
    return '<div class="me">' +
      (opciones.sinModulos ? '' : seccion('modulo', 'Módulos del menú', 'Lo apagado sale de Gestión, de la barra de abajo y del inicio, y su servidor deja de aceptar registros de eso.', modulos(), (k) => mods[k] === false)) +
      seccion('preop', 'Preoperacionales', 'Los que se ofrecen en la tarjeta «Preoperacional» del inicio.', preops(), en('preop')) +
      seccion('inspecciones', 'Listas de inspección', 'Las que se pueden escoger en «Inspecciones planeadas».', inspecciones(), en('inspecciones')) +
      '</div>';
  }
  /** Después de pintar html(): activa «Todos / Ninguno» y los contadores. */
  function activar(raiz) {
    estilos();
    const contar = (d) => { const cs = [...d.querySelectorAll('input[data-me]')], on = cs.filter((c) => c.checked).length; d.querySelector('[data-n]').textContent = on + ' de ' + cs.length; d.querySelector('[data-todos]').textContent = on === cs.length ? 'Ninguno' : 'Todos'; d.classList.toggle('me-off', !on); };
    raiz.querySelectorAll('.me-g').forEach(contar);
    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('[data-todos]'); if (!b || !raiz.contains(b)) return; e.preventDefault();
      const d = b.closest('.me-g'), cs = [...d.querySelectorAll('input[data-me]')], todos = cs.every((c) => c.checked);
      cs.forEach((c) => { c.checked = !todos; }); contar(d);
    });
    raiz.addEventListener('change', (e) => { const d = e.target.closest && e.target.closest('.me-g'); if (d) contar(d); });
  }
  /** Lee lo marcado: { modulos: {k: bool}, ocultos: { preop: [ids], inspecciones: [ids] } }. */
  function leer(raiz, modulosAntes) {
    const modulos = Object.assign({}, modulosAntes || {}), ocultos = { preop: [], inspecciones: [] };
    raiz.querySelectorAll('input[data-me]').forEach((c) => {
      if (c.dataset.me === 'modulo') modulos[c.dataset.id] = c.checked;
      else if (!c.checked) ocultos[c.dataset.me].push(c.dataset.id);
    });
    return { modulos, ocultos };
  }
  let puesto = false;
  function estilos() {
    if (puesto || typeof document === 'undefined') return; puesto = true;
    const st = document.createElement('style');
    st.textContent = '.me-sec{margin:14px 0 6px;}.me-sec h4{margin:0 0 2px;font-size:15px;}.me-ayuda{margin:0 0 8px;font-size:12.5px;color:var(--muted,#5b6b80);}' +
      '.me-g{border:1.5px solid var(--line,#dfe6ef);border-radius:14px;margin-bottom:8px;background:#fff;}.me-g.me-off{opacity:.7;}' +
      '.me-g summary{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;list-style:none;}.me-g summary::-webkit-details-marker{display:none;}' +
      '.me-gt{font-weight:800;font-size:14px;}.me-n{margin-left:auto;font-size:12px;font-weight:800;background:#eef3f9;border-radius:99px;padding:3px 10px;white-space:nowrap;}' +
      '.me-todos{border:1.5px solid var(--line,#dfe6ef);background:#fff;border-radius:99px;padding:5px 11px;font:700 12.5px inherit;font-family:inherit;cursor:pointer;min-height:34px;}' +
      '.me-chev{width:18px;height:18px;flex:none;transition:transform .2s;}.me-g[open] .me-chev{transform:rotate(180deg);}' +
      '.me-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:2px 10px;padding:0 12px 10px;}' +
      '.me-it{display:flex;gap:9px;align-items:flex-start;font-size:14px;padding:7px 2px;cursor:pointer;}.me-it input{width:20px;height:20px;flex:none;margin:1px 0 0;}' +
      '.me-it small{display:block;font-size:11.5px;color:var(--muted,#5b6b80);}';
    document.head.appendChild(st);
  }
  return { html, activar, leer, preops, inspecciones, modulos };
})();
if (typeof module !== 'undefined') module.exports = MenusEmpresa;
