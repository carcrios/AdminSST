/* ============================================================
   importar.js — Carga masiva: escribir en una tabla o pegar de Excel
   ------------------------------------------------------------
   Para arrancar una empresa sin digitar uno a uno: trabajadores,
   equipos, sustancias, normas y peligros. Dos caminos en la misma
   ventana:
     · «Escribir en una tabla» (v107): cuadrícula tipo hoja donde se
       escribe directo, se agregan filas y se pegan varias celdas de
       Excel de una vez. Cada cuadro se revisa (obligatorios, cédula,
       fechas, listas) y lo malo queda en rojo diciendo qué falta.
       En el celular cada fila es una tarjeta con sus cuadros.
     · «Pegar o subir Excel»: se descarga la plantilla, se llena en
       Excel y se pega aquí (o se sube guardada como CSV).
   Los dos guardan igual: por lotes en el servidor (guardarLote).

   Importar.abrir({
     titulo, archivo,                  // título y nombre de la plantilla
     modo: 'tabla' | 'pegar',          // con qué pestaña abre (por defecto: pegar)
     fila: 'persona',                  // cómo se llama cada fila en la tabla
     columnas: [{ k, l, req, tipo: 'texto'|'numero'|'fecha'|'sino'|'lista'|'listas'|'cedula',
                  op: [...], sin: ['otros nombres'], ej, ayuda,
                  unico: true,          // no se puede repetir entre filas
                  noFutura: true,       // fecha: no puede ser posterior a hoy
                  avisarVencida: true,  // fecha: si ya pasó, avisa (no bloquea)
                  sugerencias: [...],   // texto: lista de sugerencias (cargos, áreas…)
                  extra: true|false }], // en el celular va en «Más datos» (por defecto: vista === false)
     tipoDoc,                          // tipo del registro en el SG-SST
     id: (fila) => 'TRB-…',            // id del registro (el mismo si ya existe)
     existe: (id) => true|false,
     armar: (fila) => campos,          // lo que se guarda (parche: no borra lo demás)
     validar: (fila) => '' | 'error' | { k, msg } | [{ k, msg }],
     alTerminar: () => {}
   })
   ============================================================ */
const Importar = (function () {
  const LOTE = 8;   // pocos por envío: el servidor atiende de a uno y no debe hacer esperar a los demás
  const norm = (t) => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const escH = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoyISO = () => (typeof Festivos !== 'undefined' && Festivos.hoy) ? Festivos.hoy() : new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10);
  const dma = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : iso;

  /** Texto pegado de Excel (tabuladores) o CSV (; o ,) → filas de celdas. Respeta comillas. */
  function leerTabla(texto, sepFijo) {
    texto = String(texto || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const primera = texto.split('\n').find((l) => l.trim()) || '';
    const cuenta = (c) => primera.split(c).length - 1;
    const sep = sepFijo || (cuenta('\t') ? '\t' : cuenta(';') >= cuenta(',') ? ';' : ',');
    const filas = []; let fila = [], celda = '', comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (comillas) {
        if (ch === '"') { if (texto[i + 1] === '"') { celda += '"'; i++; } else comillas = false; }
        else celda += ch;
      } else if (ch === '"' && celda === '') comillas = true;
      else if (ch === sep) { fila.push(celda); celda = ''; }
      else if (ch === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
      else celda += ch;
    }
    if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }
    return filas.map((f) => f.map((c) => c.trim())).filter((f) => f.some((c) => c !== ''));
  }
  const valida = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === iso; };
  /** Fecha de Excel: 2026-03-15, 15/03/2026, 15-03-26, o el número de serie (46096). */
  function fecha(v) {
    v = String(v || '').trim(); if (!v) return '';
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
    if (m) { const iso = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'); return valida(iso) ? iso : null; }
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v);
    if (m) { const a = m[3].length === 2 ? '20' + m[3] : m[3], iso = a + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
      return valida(iso) ? iso : null; }
    if (/^\d{5}$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 864e5); return d.toISOString().slice(0, 10); }
    return null;
  }
  /** Número con coma decimal o punto de miles (1.234,5 · 1234,5 · 1234.5). */
  function numero(v) {
    v = String(v || '').trim().replace(/\s/g, ''); if (!v) return '';
    if (/,/.test(v) && /\./.test(v)) v = v.replace(/\./g, '').replace(',', '.');
    else if (/,/.test(v)) v = v.replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');   // 1.500 → mil quinientos (punto de miles)
    const n = Number(v); return isNaN(n) ? null : n;
  }
  function sino(v) { const t = norm(v); if (!t) return ''; if (/^(si|s|x|1|true|verdadero|yes)$/.test(t)) return true; if (/^(no|n|0|false|falso)$/.test(t)) return false; return null; }
  function opcion(v, op) { const t = norm(v); if (!t) return ''; const o = op.find((x) => norm(Array.isArray(x) ? x[0] : x) === t || (Array.isArray(x) && norm(x[1]) === t)); return o === undefined ? null : (Array.isArray(o) ? o[0] : o); }
  /** Cédula: solo dígitos, de 6 a 10 (se aceptan puntos y espacios de Excel: 1.020.304.050). */
  function cedula(v) {
    const s = String(v == null ? '' : v).trim(); if (!s) return { v: '' };
    if (/e\+?\d/i.test(s)) return { v: null, e: 'salió en notación científica (ej. 1,02E+09): en Excel dale a esa columna formato Número sin decimales y vuelve a copiar' };
    const d = s.replace(/[.\s,]/g, '');
    if (!/^\d+$/.test(d)) return { v: null, e: 'solo números (sin letras ni guiones)' };
    if (d.length < 6 || d.length > 10) return { v: null, e: 'debe tener de 6 a 10 dígitos (tiene ' + d.length + ')' };
    return { v: d };
  }

  /** Encabezados de la tabla → columna de la configuración (por nombre, clave u otros nombres). */
  function mapear(encabezados, columnas) {
    const idx = {};
    columnas.forEach((c) => {
      const nombres = [c.l, c.k].concat(c.sin || []).map(norm);
      const i = encabezados.findIndex((h) => nombres.indexOf(norm(h).replace(/ ?\*$/, '')) !== -1 || nombres.indexOf(norm(h)) !== -1);
      if (i !== -1) idx[c.k] = i;
    });
    return idx;
  }
  /** Celdas de una fila → valores convertidos, errores (también por columna) y avisos que no bloquean. */
  function convertir(celdas, idx, columnas) {
    const f = {}, errores = [], porCol = {}, avisos = {}, h = hoyISO();
    columnas.forEach((c) => {
      const crudo = idx[c.k] === undefined ? '' : (celdas[idx[c.k]] == null ? '' : String(celdas[idx[c.k]]));
      let v = crudo, e = '';
      if (c.tipo === 'fecha') v = fecha(crudo);
      else if (c.tipo === 'numero') v = numero(crudo);
      else if (c.tipo === 'sino') v = sino(crudo);
      else if (c.tipo === 'lista') v = opcion(crudo, c.op);
      else if (c.tipo === 'listas') { const partes = String(crudo).split(/\s*[;,|]\s*/).filter(Boolean); const ok = partes.map((p) => opcion(p, c.op)); v = ok.indexOf(null) === -1 ? ok : null; }
      else if (c.tipo === 'cedula') { const r = cedula(crudo); v = r.v; if (v === null) { e = c.l + ': «' + crudo + '» ' + r.e; v = ''; } }
      if (v === null) { e = c.l + ': «' + crudo + '» no se entiende' + (c.op ? ' (opciones: ' + c.op.map((x) => Array.isArray(x) ? x[1] : x).slice(0, 8).join(', ') + ')' : c.tipo === 'fecha' ? ' (usa dd/mm/aaaa)' : c.tipo === 'numero' ? ' (escribe un número)' : ''); v = ''; }
      else if (!e && c.req && (v === '' || v == null || (Array.isArray(v) && !v.length))) e = 'Falta ' + c.l;
      else if (!e && c.tipo === 'numero' && typeof v === 'number' && v < 0 && c.negativo !== true) e = c.l + ': no puede ser negativo';
      else if (!e && c.tipo === 'fecha' && v) {
        if (c.noFutura && v > h) e = c.l + ': la fecha (' + dma(v) + ') es posterior a hoy';
        else if (c.avisarVencida && v < h) avisos[c.k] = c.l + ': ya venció (' + dma(v) + ')';
      }
      if (e) { errores.push(e); porCol[c.k] = e; }
      f[c.k] = v;
    });
    return { f, errores, porCol, avisos };
  }
  /** Lo que devuelve cfg.validar → lista de {k, msg} (k vacío: error de toda la fila). */
  function erroresDe(r) {
    if (!r) return [];
    return [].concat(r).filter(Boolean).map((x) => typeof x === 'string' ? { k: '', msg: x } : { k: x.k || '', msg: x.msg || '' }).filter((x) => x.msg);
  }
  /** Una fila completa: conversión, validación propia del módulo, repetidas e id. Igual para la tabla y para lo pegado. */
  function procesar(celdas, idx, cfg, vistos, n, unicos) {
    const { f, errores, porCol, avisos } = convertir(celdas, idx, cfg.columnas);
    // Columnas que no se pueden repetir (p. ej. la cédula): se marca el cuadro.
    if (unicos) cfg.columnas.forEach((c) => { if (!c.unico || porCol[c.k]) return; const v = norm(f[c.k]); if (!v) return;
      const k = c.k + '|' + v; if (unicos[k]) { const e = c.l + ' repetida con la fila ' + unicos[k]; errores.push(e); porCol[c.k] = e; } else unicos[k] = n; });
    let id = '';
    if (!errores.length) {
      const ev = erroresDe(cfg.validar ? cfg.validar(f) : '');
      ev.forEach((x) => { errores.push(x.msg); if (x.k && !porCol[x.k]) porCol[x.k] = x.msg; });
      if (!ev.length) { id = cfg.id(f); if (vistos[id]) errores.push('Repetida con la fila ' + vistos[id]); else vistos[id] = n; }
    }
    const existe = id ? !!cfg.existe(id) : false;
    // Los valores por defecto son solo para registros nuevos: en uno que ya existe, la celda vacía deja lo que tenía.
    if (!existe) cfg.columnas.forEach((c) => { if (c.def !== undefined && (f[c.k] === '' || f[c.k] == null)) f[c.k] = c.def; });
    return { n, f, id, errores, porCol, avisos, existe };
  }

  function plantillaCSV(cfg) {
    const q = (t) => /[;"\n]/.test(String(t)) ? '"' + String(t).replace(/"/g, '""') + '"' : String(t);
    return '﻿' + cfg.columnas.map((c) => q(c.l + (c.req ? ' *' : ''))).join(';') + '\n' + cfg.columnas.map((c) => q(c.ej == null ? '' : c.ej)).join(';') + '\n';
  }
  function descargar(nombre, texto) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function leerArchivo(archivo) {
    return new Promise((ok, mal) => {
      if (/\.xlsx?$/i.test(archivo.name)) { mal(new Error('Ese es un archivo de Excel. En Excel: Archivo → Guardar como → CSV (delimitado por comas), o copia las celdas y pégalas aquí.')); return; }
      const fr = new FileReader();
      fr.onload = () => {
        const buf = new Uint8Array(fr.result);
        let t = new TextDecoder('utf-8').decode(buf);
        if (t.indexOf('�') !== -1) { try { t = new TextDecoder('windows-1252').decode(buf); } catch (e) {} }   // CSV de Excel en Windows
        ok(t);
      };
      fr.onerror = () => mal(fr.error);
      fr.readAsArrayBuffer(archivo);
    });
  }

  /** Analiza todo lo pegado: filas listas, errores y repetidos. */
  function analizar(texto, cfg) {
    const tabla = leerTabla(texto);
    if (tabla.length < 2) return { error: 'Pega la tabla con su fila de títulos (la primera fila de la plantilla) y al menos una fila de datos.' };
    const idx = mapear(tabla[0], cfg.columnas);
    const faltan = cfg.columnas.filter((c) => c.req && idx[c.k] === undefined).map((c) => c.l);
    if (faltan.length) return { error: 'No encuentro la(s) columna(s): ' + faltan.join(', ') + '. Usa los títulos de la plantilla.' };
    const ignoradas = tabla[0].filter((h, i) => h && Object.keys(idx).every((k) => idx[k] !== i));
    const vistos = {}, unicos = {};
    const filas = tabla.slice(1).map((celdas, n) => procesar(celdas, idx, cfg, vistos, n + 2, unicos));
    return { filas, ignoradas, columnas: Object.keys(idx).length };
  }

  /** Guarda las filas buenas por lotes (el mismo camino para la tabla y para lo pegado). */
  async function guardarFilas(cfg, buenas, msg) {
    let hechas = 0; const fallas = [], okN = [];
    for (let i = 0; i < buenas.length; i += LOTE) {
      const lote = buenas.slice(i, i + LOTE);
      if (msg) msg.textContent = 'Guardando ' + Math.min(i + LOTE, buenas.length) + ' de ' + buenas.length + '…';
      const items = lote.map((x) => ({ tipo: cfg.tipoDoc, id: x.id, campos: soloLlenos(cfg.armar(x.f, x.existe), x.existe) }));
      let r;
      try { r = await SGSST.enviar({ action: 'guardarLote', items }, null, { sinCola: true }); } catch (e) { r = { ok: false, error: e.message }; }
      if (!r || !r.ok) { lote.forEach((x) => fallas.push({ n: x.n, error: (r && r.error) || 'error' })); if (r && (r.codigoError === 'SESION' || r.clave || r.codigoError === 'PERMISO')) break; continue; }
      (r.resultados || []).forEach((res, k) => { if (res.ok) { hechas++; okN.push(lote[k].n); } else fallas.push({ n: lote[k].n, error: res.error || 'error' }); });
    }
    return { hechas, fallas, okN };
  }
  function informe(res) {
    return '✓ ' + res.hechas + ' registro(s) guardado(s).' + (res.fallas.length ? '<br><span style="color:var(--mal);">' + res.fallas.length + ' no se guardaron:<br>' +
      res.fallas.slice(0, 15).map((x) => escH('Fila ' + x.n + ': ' + x.error)).join('<br>') + (res.fallas.length > 15 ? '<br>…' : '') + '</span>' : '');
  }

  /* ── Estilos de la tabla (van aquí para no depender de otra hoja de estilos) ── */
  function estilos() {
    if (document.getElementById('impEstilos')) return;
    const s = document.createElement('style'); s.id = 'impEstilos';
    s.textContent = '.modal.imp-ancho{max-width:1180px;}' +
      '.imp-tabs{display:flex;gap:6px;margin:0 0 12px;flex-wrap:wrap;}' +
      '.imp-tabs button{flex:1 1 140px;min-height:44px;border:1.5px solid var(--line);background:#fff;border-radius:10px;font-weight:700;font-size:13.5px;font-family:inherit;color:var(--ink);cursor:pointer;padding:8px 10px;}' +
      '.imp-tabs button.on{background:var(--ink);color:#fff;border-color:var(--ink);}' +
      '.imp-acc{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px;}.imp-acc .btn{flex:1 1 150px;margin:0;min-height:44px;}' +
      '.imp-wrap{overflow:auto;max-height:58vh;border:1px solid var(--line);border-radius:10px;margin-bottom:10px;-webkit-overflow-scrolling:touch;}' +
      '.imp-grid{border-collapse:separate;border-spacing:0;font-size:13px;min-width:100%;}' +
      '.imp-grid th{position:sticky;top:0;z-index:2;background:#f3f5f8;text-align:left;font-size:11px;font-weight:700;color:#3c4752;padding:6px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);white-space:nowrap;}' +
      '.imp-grid th.req{color:#151b24;}.imp-grid th .rq{color:var(--mal);}' +
      '.imp-grid td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:0;vertical-align:top;background:#fff;}' +
      '.imp-grid td.imp-n,.imp-grid th:first-child{position:sticky;left:0;z-index:1;background:#f8f9fb;text-align:center;font-size:11.5px;font-weight:700;color:#5c6a76;min-width:44px;padding:6px 4px;}' +
      '.imp-grid th:first-child{z-index:3;}' +
      '.imp-grid td input,.imp-grid td select{width:100%;min-width:var(--w,150px);border:0;border-radius:0;padding:10px 8px;font-size:14px;min-height:42px;background:transparent;font-family:inherit;color:var(--ink);box-sizing:border-box;}' +
      '.imp-grid td input:focus,.imp-grid td select:focus{outline:2px solid #2f6fbf;outline-offset:-2px;background:#f4f8fd;}' +
      '.imp-grid td.mal{background:#fdecea;box-shadow:inset 0 0 0 2px #c0392b;}.imp-grid td.ojo{background:#fff8e6;}' +
      '.imp-grid .imp-e{display:none;font-size:11px;line-height:1.3;color:#9b2c1f;padding:0 8px 6px;font-weight:600;max-width:240px;}' +
      '.imp-grid td.mal .imp-e{display:block;}.imp-grid td.ojo .imp-e{display:block;color:#6b4e00;}' +
      '.imp-grid .imp-lbl{display:none;}.imp-grid .imp-mas{display:none;}' +
      '.imp-grid td.imp-del{text-align:center;min-width:44px;}.imp-grid td.imp-del button{border:0;background:none;font-size:20px;line-height:1;width:44px;height:42px;cursor:pointer;color:#8a2a1c;}' +
      '.imp-grid tr.fmal td.imp-n{background:#fbe0dc;color:#9b2c1f;}.imp-grid tr.fok td.imp-n{color:var(--ok);}' +
      '.imp-grid .imp-est{display:block;font-size:10px;font-weight:600;}' +
      '.imp-faltas{background:#fdf1ef;border:1px solid #f0c8c1;color:#8a2a1c;border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.45;margin-bottom:10px;max-height:150px;overflow:auto;}' +
      '.imp-faltas button{border:0;background:none;color:inherit;text-decoration:underline;font:inherit;cursor:pointer;padding:0;text-align:left;}' +
      '@media (max-width:700px){' +
        '.imp-wrap{max-height:none;overflow:visible;border:0;}' +
        '.imp-grid,.imp-grid tbody{display:block;min-width:0;width:100%;}.imp-grid thead{display:none;}' +
        '.imp-grid tr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 10px;border:1px solid var(--line);border-left:5px solid #c8d0d6;border-radius:12px;padding:10px 12px 12px;margin-bottom:10px;background:#fff;position:relative;}' +
        '.imp-grid tr.fmal{border-left-color:var(--mal);}.imp-grid tr.fok{border-left-color:var(--ok);}' +
        '.imp-grid td{display:block;border:0;background:none;min-width:0;}' +
        '.imp-grid td.w2{grid-column:1/-1;}' +
        '.imp-grid td.imp-n{position:static;grid-column:1/-1;background:none;text-align:left;font-size:13px;color:var(--ink);padding:0 48px 0 0;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;}' +
        '.imp-grid tr.fmal td.imp-n{background:none;}' +
        '.imp-grid td.imp-del{position:absolute;top:2px;right:2px;min-width:0;}' +
        '.imp-grid .imp-lbl{display:block;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;letter-spacing:.02em;}' +
        '.imp-grid td input,.imp-grid td select{min-width:0;border:1.5px solid var(--line);border-radius:8px;background:#fcfbf8;font-size:16px;min-height:46px;padding:10px 11px;}' +
        '.imp-grid td.mal,.imp-grid td.ojo{box-shadow:none;background:none;}' +
        '.imp-grid td.mal input,.imp-grid td.mal select{border:2px solid #c0392b;background:#fdecea;}.imp-grid td.ojo input{border-color:#e0b84a;background:#fff8e6;}' +
        '.imp-grid .imp-e{padding:4px 0 0;max-width:none;}' +
        '.imp-grid td.extra{display:none;}.imp-grid tr.abierta td.extra{display:block;}' +
        '.imp-grid .imp-mas{display:inline-flex;align-items:center;min-height:36px;border:1.5px solid var(--line);background:#fff;border-radius:18px;padding:4px 12px;font-size:12.5px;font-weight:700;font-family:inherit;color:var(--ink);cursor:pointer;}' +
        '.imp-grid .imp-est{display:inline;font-size:11.5px;}' +
      '}';
    document.head.appendChild(s);
  }

  /** Ancho de cada columna en la tabla y si en el celular ocupa toda la tarjeta. */
  function medida(c) {
    if (c.tipo === 'fecha') return { w: 150, w2: false };
    if (c.tipo === 'numero') return { w: 110, w2: false };
    if (c.tipo === 'sino') return { w: 100, w2: false };
    if (c.tipo === 'cedula') return { w: 140, w2: false };
    if (c.tipo === 'lista') { const largo = Math.max.apply(null, (c.op || []).map((o) => String(Array.isArray(o) ? o[1] : o).length).concat([6])); return { w: Math.min(260, 70 + largo * 7), w2: largo > 16 }; }
    if (/nombre|descrip|peligro|requisito|norma|tarea|actividad/i.test(c.k + ' ' + c.l)) return { w: 230, w2: true };
    return { w: 170, w2: true };
  }

  function abrir(cfg) {
    estilos();
    const base = String(cfg.titulo || 'Carga masiva').replace(/\s+desde Excel$/i, '');
    const filaN = cfg.fila || 'fila';
    const m = UI.modal('<h3>' + escH(base) + '</h3>' +
      '<div class="imp-tabs" role="tablist"><button type="button" data-modo="tabla">Escribir en una tabla</button><button type="button" data-modo="pegar">Pegar o subir Excel</button></div>' +
      '<div data-panel="tabla"></div>' +
      '<div data-panel="pegar">' +
        '<p class="ayuda"><b>1.</b> Descarga la plantilla y llénala en Excel (una fila por registro; los títulos con * son obligatorios). <b>2.</b> Copia las celdas, títulos incluidos, y pégalas aquí, o sube el archivo guardado como CSV. <b>3.</b> Revisa y carga.</p>' +
        '<button type="button" class="btn ghost" data-plantilla>⬇️ Plantilla (' + escH(cfg.archivo) + '.csv)</button>' +
        '<div class="field"><textarea data-pegar rows="6" placeholder="Pega aquí las celdas copiadas de Excel (con la fila de títulos)" style="font-family:ui-monospace,monospace;font-size:12px;"></textarea></div>' +
        '<div class="field"><label>O sube el archivo (CSV)</label><input type="file" data-archivo accept=".csv,.txt,.tsv,text/csv,text/plain"></div>' +
        '<div data-vista></div>' +
        '<button type="button" class="btn amber" data-cargar disabled>Cargar</button><div class="status-msg" data-msg></div>' +
      '</div>' +
      '<button type="button" class="btn ghost" data-cerrar>Cerrar</button>', true);
    const $m = (s) => m.el.querySelector(s);
    const tabla = montarTabla($m('[data-panel="tabla"]'), cfg, filaN);
    const modo = (k) => {
      m.el.querySelectorAll('[data-modo]').forEach((b) => { b.classList.toggle('on', b.dataset.modo === k); b.setAttribute('aria-selected', b.dataset.modo === k); });
      m.el.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== k; });
      m.el.classList.toggle('imp-ancho', k === 'tabla');
    };
    m.el.querySelector('.imp-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-modo]'); if (b) modo(b.dataset.modo); });
    modo(cfg.modo === 'tabla' ? 'tabla' : 'pegar');

    /* ── Pegar o subir Excel ── */
    let analisis = null;
    $m('[data-plantilla]').addEventListener('click', () => descargar('plantilla-' + cfg.archivo + '.csv', plantillaCSV(cfg)));
    const ver = () => {
      const t = $m('[data-pegar]').value;
      analisis = t.trim() ? analizar(t, cfg) : null;
      const v = $m('[data-vista]'), b = $m('[data-cargar]');
      if (!analisis) { v.innerHTML = ''; b.disabled = true; return; }
      if (analisis.error) { v.innerHTML = '<div class="aviso">' + escH(analisis.error) + '</div>'; b.disabled = true; return; }
      const fs = analisis.filas, buenas = fs.filter((x) => !x.errores.length), nuevas = buenas.filter((x) => !x.existe).length;
      const vis = cfg.columnas.filter((c) => c.vista !== false).slice(0, 4);
      v.innerHTML = '<div class="aviso ' + (fs.length === buenas.length ? 'info' : 'amar') + '"><b>' + fs.length + ' fila(s):</b> ' + nuevas + ' nueva(s), ' + (buenas.length - nuevas) + ' actualiza(n) un registro que ya existe' + (fs.length - buenas.length ? ', <b>' + (fs.length - buenas.length) + ' con errores (no se cargan)</b>' : '') + '.' +
        (analisis.ignoradas.length ? '<br><small>Columnas que no se usan: ' + escH(analisis.ignoradas.join(', ')) + '</small>' : '') + '</div>' +
        '<div style="overflow-x:auto;max-height:260px;overflow-y:auto;border:1px solid var(--line);border-radius:10px;margin-bottom:10px;"><table style="width:100%;border-collapse:collapse;font-size:12px;">' +
        '<tr style="background:#f3f5f8;"><th style="padding:5px;text-align:left;">Fila</th>' + vis.map((c) => '<th style="padding:5px;text-align:left;">' + escH(c.l) + '</th>').join('') + '<th style="padding:5px;text-align:left;">Resultado</th></tr>' +
        fs.slice(0, 200).map((x) => '<tr style="border-top:1px solid var(--line);' + (x.errores.length ? 'background:#fdecea;' : '') + '"><td style="padding:5px;">' + x.n + '</td>' + vis.map((c) => '<td style="padding:5px;">' + escH(Array.isArray(x.f[c.k]) ? x.f[c.k].join(', ') : x.f[c.k] === true ? 'Sí' : x.f[c.k] === false ? 'No' : x.f[c.k]) + '</td>').join('') +
          '<td style="padding:5px;">' + (x.errores.length ? '✗ ' + escH(x.errores.join(' · ')) : x.existe ? '↻ Actualiza' : '＋ Nuevo') + '</td></tr>').join('') +
        (fs.length > 200 ? '<tr><td colspan="9" style="padding:5px;">… y ' + (fs.length - 200) + ' más</td></tr>' : '') + '</table></div>';
      b.disabled = !buenas.length; b.textContent = 'Cargar ' + buenas.length + ' registro(s)';
    };
    $m('[data-pegar]').addEventListener('input', ver);
    $m('[data-archivo]').addEventListener('change', async () => {
      const f = $m('[data-archivo]').files[0]; if (!f) return;
      try { $m('[data-pegar]').value = await leerArchivo(f); ver(); } catch (e) { $m('[data-vista]').innerHTML = '<div class="aviso">' + escH(e.message) + '</div>'; }
    });
    $m('[data-cargar]').addEventListener('click', async () => {
      if (!analisis || analisis.error) return;
      if (!navigator.onLine) { $m('[data-msg]').textContent = 'La carga masiva necesita señal.'; return; }
      const buenas = analisis.filas.filter((x) => !x.errores.length), msg = $m('[data-msg]'), b = $m('[data-cargar]');
      b.disabled = true; $m('[data-pegar]').disabled = true;
      const res = await guardarFilas(cfg, buenas, msg);
      msg.innerHTML = informe(res);
      b.textContent = 'Listo'; if (cfg.alTerminar) cfg.alTerminar(res.hechas);
    });
    m.tabla = tabla;
    return m;
  }

  /* ── Escribir en una tabla ── */
  function montarTabla(cont, cfg, filaN) {
    const cols = cfg.columnas, CLAVE = 'ssta-tabla-' + (cfg.archivo || 'carga');
    const extra = (c) => c.extra != null ? !!c.extra : c.vista === false;
    const nExtra = cols.filter(extra).length;
    let intentado = false;
    const tocadas = new WeakSet();
    const sug = cols.filter((c) => (c.sugerencias || []).length);
    cont.innerHTML = '<p class="ayuda">Escribe una ' + escH(filaN) + ' por fila. Puedes copiar varias celdas de Excel y pegarlas en cualquier cuadro: se reparten solas (si copias también los títulos, cada columna va a su lugar). Los títulos con <b style="color:var(--mal);">*</b> son obligatorios.</p>' +
      '<div data-borrador></div>' +
      '<div class="imp-acc"><button type="button" class="btn amber" data-tguardar>Guardar todo</button><button type="button" class="btn ghost" data-tfila>+ Agregar fila</button></div>' +
      '<div data-tfaltas></div>' +
      '<div class="imp-wrap" data-sin-valida><table class="imp-grid"><thead><tr><th>#</th>' + cols.map((c) => '<th class="' + (c.req ? 'req' : '') + '"' + (c.ayuda ? ' title="' + escH(c.ayuda) + '"' : '') + '>' + escH(c.l) + (c.req ? ' <span class="rq">*</span>' : '') + '</th>').join('') + '<th><span style="position:absolute;left:-9999px;">Quitar</span></th></tr></thead><tbody></tbody></table></div>' +
      sug.map((c) => '<datalist id="impSug_' + escH(c.k) + '">' + c.sugerencias.map((s) => '<option value="' + escH(s) + '">').join('') + '</datalist>').join('') +
      '<div class="imp-acc"><button type="button" class="btn ghost" data-tfila>+ Agregar fila</button><button type="button" class="btn ghost" data-tfila="5">+ 5 filas</button></div>' +
      '<div class="status-msg" data-tmsg></div>';
    const tb = cont.querySelector('tbody'), $c = (s) => cont.querySelector(s);

    function control(c) {
      const ph = c.ej ? ' placeholder="' + escH('Ej: ' + (c.tipo === 'fecha' ? (fecha(c.ej) ? dma(fecha(c.ej)) : c.ej) : c.ej)) + '"' : '';
      const comun = ' data-k="' + escH(c.k) + '" aria-label="' + escH(c.l) + (c.req ? ' (obligatorio)' : '') + '"';
      if (c.tipo === 'fecha') return '<input type="date"' + comun + '>';
      if (c.tipo === 'sino') return '<select' + comun + '><option value="">' + (c.def === true ? '— (Sí)' : c.def === false ? '— (No)' : '—') + '</option><option>Sí</option><option>No</option></select>';
      if (c.tipo === 'lista') { const d = c.def != null ? (c.op.find((o) => (Array.isArray(o) ? o[0] : o) === c.def) || c.def) : null;
        return '<select' + comun + '><option value="">' + (d != null ? '— (' + escH(Array.isArray(d) ? d[1] : d) + ')' : '—') + '</option>' + c.op.map((o) => '<option value="' + escH(Array.isArray(o) ? o[0] : o) + '">' + escH(Array.isArray(o) ? o[1] : o) + '</option>').join('') + '</select>'; }
      if (c.tipo === 'numero') return '<input type="text" inputmode="decimal"' + comun + ph + '>';
      if (c.tipo === 'cedula') return '<input type="text" inputmode="numeric" autocomplete="off"' + comun + ph + '>';
      if (c.tipo === 'listas') return '<input type="text"' + comun + ' placeholder="' + escH('Separa con coma: ' + c.op.slice(0, 3).map((o) => Array.isArray(o) ? o[1] : o).join(', ') + '…') + '">';
      return '<input type="text"' + comun + ph + ((c.sugerencias || []).length ? ' list="impSug_' + escH(c.k) + '"' : '') + ' autocomplete="off">';
    }
    function filaHTML() {
      return '<tr><td class="imp-n"><span data-num></span><span class="imp-est" data-est></span>' + (nExtra ? '<button type="button" class="imp-mas" data-mas aria-expanded="false">Más datos (' + nExtra + ')</button>' : '') + '</td>' +
        cols.map((c) => { const md = medida(c); return '<td class="' + (md.w2 ? 'w2' : '') + (extra(c) ? ' extra' : '') + '" data-c="' + escH(c.k) + '" style="--w:' + md.w + 'px;"><label class="imp-lbl">' + escH(c.l) + (c.req ? ' <span style="color:var(--mal);">*</span>' : '') + '</label>' + control(c) + '<div class="imp-e" role="alert"></div></td>'; }).join('') +
        '<td class="imp-del"><button type="button" data-quitar title="Quitar esta fila" aria-label="Quitar esta fila">×</button></td></tr>';
    }
    function numerar() { [...tb.rows].forEach((tr, i) => { tr.querySelector('[data-num]').textContent = (window.matchMedia && matchMedia('(max-width:700px)').matches ? filaN.charAt(0).toUpperCase() + filaN.slice(1) + ' ' : '') + (i + 1); }); }
    function agregar(n) {
      for (let i = 0; i < (n || 1); i++) tb.insertAdjacentHTML('beforeend', filaHTML());
      // La tabla revisa sus propios cuadros (data-sin-valida); la cédula, además, no deja escribir letras.
      if (typeof Valida !== 'undefined') cols.filter((c) => c.tipo === 'cedula').forEach((c) => tb.querySelectorAll('[data-k="' + c.k + '"]').forEach((el) => Valida.soloDigitos(el, 10)));
      numerar();
    }
    const inp = (tr, k) => tr.querySelector('[data-k="' + k + '"]');
    /** Pone un valor en un cuadro convirtiéndolo (fechas, listas, sí/no); si no se entiende queda marcado. */
    function poner(tr, c, crudo) {
      const el = inp(tr, c.k), td = el.closest('td'); crudo = String(crudo == null ? '' : crudo).trim();
      delete td.dataset.crudo;
      if (c.tipo === 'fecha') { const iso = fecha(crudo); el.value = iso || ''; if (crudo && !iso) td.dataset.crudo = crudo; }
      else if (c.tipo === 'lista') { const o = opcion(crudo, c.op); el.value = o || ''; if (crudo && o == null) td.dataset.crudo = crudo; }
      else if (c.tipo === 'sino') { const s = sino(crudo); el.value = s === true ? 'Sí' : s === false ? 'No' : ''; if (crudo && s == null) td.dataset.crudo = crudo; }
      else el.value = crudo;
    }
    const crudoDe = (tr, c) => { const el = inp(tr, c.k), td = el.closest('td'); return td.dataset.crudo != null ? td.dataset.crudo : el.value; };
    const vacia = (tr) => cols.every((c) => !String(crudoDe(tr, c)).trim());

    /** Revisa todas las filas: marca cada cuadro y devuelve las filas procesadas. */
    function revisar() {
      const vistos = {}, unicos = {}, out = [];
      [...tb.rows].forEach((tr, i) => {
        tr.classList.remove('fmal', 'fok');
        const est = tr.querySelector('[data-est]'); est.textContent = '';
        tr.querySelectorAll('td[data-c]').forEach((td) => { td.classList.remove('mal', 'ojo'); td.querySelector('.imp-e').textContent = ''; });
        if (vacia(tr)) return;
        const celdas = cols.map((c) => crudoDe(tr, c)), idx = {}; cols.forEach((c, j) => { idx[c.k] = j; });
        const x = procesar(celdas, idx, cfg, vistos, i + 1, unicos); x.tr = tr; out.push(x);
        const mostrarFaltas = intentado || tocadas.has(tr);
        // Las faltas de obligatorios se muestran cuando ya se salió de la fila (o al guardar); lo mal escrito, de una vez.
        const errs = Object.keys(x.porCol).filter((k) => mostrarFaltas || !/^Falta /.test(x.porCol[k]));
        errs.forEach((k) => { const td = tr.querySelector('td[data-c="' + k + '"]'); if (!td) return; td.classList.add('mal'); td.querySelector('.imp-e').textContent = x.porCol[k]; if (td.classList.contains('extra')) abrirFila(tr, true); });
        Object.keys(x.avisos).forEach((k) => { const td = tr.querySelector('td[data-c="' + k + '"]'); if (!td || td.classList.contains('mal')) return; td.classList.add('ojo'); td.querySelector('.imp-e').textContent = x.avisos[k] + ' — revísalo'; });
        const general = x.errores.filter((e) => Object.keys(x.porCol).every((k) => x.porCol[k] !== e));
        if (x.errores.length && (mostrarFaltas || errs.length || general.length)) { tr.classList.add('fmal'); est.textContent = general.length ? general.join(' · ') : 'Revisa lo marcado en rojo'; }
        else if (!x.errores.length) { tr.classList.add('fok'); est.textContent = x.existe ? 'Ya existe: se actualiza' : 'Nueva'; }
      });
      guardarBorrador();
      return out;
    }
    function abrirFila(tr, si) { const b = tr.querySelector('[data-mas]'); tr.classList.toggle('abierta', si); if (b) { b.setAttribute('aria-expanded', si); b.textContent = (si ? 'Menos datos' : 'Más datos (' + nExtra + ')'); } }
    function faltasHTML(filas) {
      const malas = filas.filter((x) => x.errores.length);
      if (!malas.length) return '';
      return '<div class="imp-faltas" role="alert"><b>' + malas.length + ' ' + (malas.length === 1 ? 'fila tiene' : 'filas tienen') + ' algo por corregir (en rojo):</b><br>' +
        malas.slice(0, 12).map((x) => '<button type="button" data-ir="' + x.n + '">Fila ' + x.n + '</button>: ' + escH(x.errores.join(' · '))).join('<br>') + (malas.length > 12 ? '<br>… y ' + (malas.length - 12) + ' más' : '') + '</div>';
    }
    function ir(n) { const tr = tb.rows[n - 1]; if (!tr) return; const td = tr.querySelector('td.mal') || tr.querySelector('td[data-c]'); if (td.classList.contains('extra')) abrirFila(tr, true); const el = td.querySelector('input,select'); el.scrollIntoView({ block: 'center' }); el.focus(); }

    /* Borrador en este equipo: si se cierra la ventana, lo escrito no se pierde. */
    function guardarBorrador() {
      try {
        const filas = [...tb.rows].filter((tr) => !vacia(tr)).map((tr) => { const o = {}; cols.forEach((c) => { const v = crudoDe(tr, c); if (v) o[c.k] = v; }); return o; });
        if (filas.length) localStorage.setItem(CLAVE, JSON.stringify({ en: Date.now(), filas })); else localStorage.removeItem(CLAVE);
      } catch (e) {}
    }
    function llenar(filas) {
      tb.innerHTML = ''; agregar(Math.max(filas.length, 1));
      filas.forEach((o, i) => cols.forEach((c) => { if (o[c.k] != null) poner(tb.rows[i], c, o[c.k]); }));
    }
    let borrador = null; try { borrador = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) {}
    if (borrador && (borrador.filas || []).length) {
      llenar(borrador.filas); agregar(1);
      $c('[data-borrador]').innerHTML = '<div class="aviso info">Se recuperó lo que habías escrito en este equipo (' + borrador.filas.length + ' fila(s)). <button type="button" class="btn mini ghost" data-limpiar style="margin-left:6px;">Empezar de cero</button></div>';
      $c('[data-limpiar]').addEventListener('click', () => { if (!confirm('¿Borrar lo escrito en la tabla?')) return; tb.innerHTML = ''; agregar(3); intentado = false; $c('[data-tfaltas]').innerHTML = ''; $c('[data-borrador]').innerHTML = ''; guardarBorrador(); });
      revisar();
    } else agregar(window.matchMedia && matchMedia('(max-width:700px)').matches ? 1 : 3);

    /* Pegar varias celdas de Excel de una vez. */
    tb.addEventListener('paste', (e) => {
      const el = e.target.closest('[data-k]'); if (!el) return;
      const texto = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(String(texto).replace(/\n+$/, ''))) return;   // una sola celda: pegado normal
      e.preventDefault();
      const t = leerTabla(texto, '\t'); if (!t.length) return;
      let r0 = [...tb.rows].indexOf(el.closest('tr'));
      const idxH = mapear(t[0], cols), conTitulos = Object.keys(idxH).length >= 2;
      const datos = conTitulos ? t.slice(1) : t;
      const c0 = cols.findIndex((c) => c.k === el.dataset.k);
      // Con títulos se llena desde la primera fila vacía (o la actual si está vacía).
      if (conTitulos && !vacia(tb.rows[r0])) { const v = [...tb.rows].findIndex((tr, i) => i > r0 && vacia(tr)); r0 = v === -1 ? tb.rows.length : v; }
      while (tb.rows.length < r0 + datos.length) agregar(1);
      datos.forEach((celdas, i) => {
        const tr = tb.rows[r0 + i];
        if (conTitulos) cols.forEach((c) => { if (idxH[c.k] !== undefined) poner(tr, c, celdas[idxH[c.k]]); });
        else celdas.forEach((v, j) => { const c = cols[c0 + j]; if (c) poner(tr, c, v); });
        tocadas.add(tr);
      });
      if (!tb.rows[tb.rows.length - 1] || !vacia(tb.rows[tb.rows.length - 1])) agregar(1);
      const filas = revisar();
      $c('[data-tmsg]').textContent = 'Se pegaron ' + datos.length + ' fila(s)' + (conTitulos ? ' (por títulos)' : '') + '.';
      if (intentado) $c('[data-tfaltas]').innerHTML = faltasHTML(filas);
    });
    const alCambiar = (e) => { const td = e.target.closest('td[data-c]'); if (!td) return; delete td.dataset.crudo; const filas = revisar(); if (intentado) $c('[data-tfaltas]').innerHTML = faltasHTML(filas); };
    tb.addEventListener('change', alCambiar);
    tb.addEventListener('input', (e) => { const td = e.target.closest('td[data-c]'); if (td && td.dataset.crudo != null) delete td.dataset.crudo; });
    // Al salir de una fila se le muestran las faltas de obligatorios.
    tb.addEventListener('focusout', (e) => { const tr = e.target.closest('tr'); if (!tr || (e.relatedTarget && tr.contains(e.relatedTarget))) return; if (!vacia(tr) && !tocadas.has(tr)) { tocadas.add(tr); revisar(); } });
    // Enter: baja al mismo cuadro de la fila siguiente (como en Excel).
    tb.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
      e.preventDefault();
      const tr = e.target.closest('tr'), i = [...tb.rows].indexOf(tr);
      if (i === tb.rows.length - 1) agregar(1);
      const sig = inp(tb.rows[i + 1], e.target.dataset.k); if (sig) sig.focus();
    });
    tb.addEventListener('click', (e) => {
      const q = e.target.closest('[data-quitar]');
      if (q) { const tr = q.closest('tr'); if (!vacia(tr) && !confirm('¿Quitar esta fila?')) return; tr.remove(); if (!tb.rows.length) agregar(1); numerar(); const f = revisar(); if (intentado) $c('[data-tfaltas]').innerHTML = faltasHTML(f); return; }
      const ms = e.target.closest('[data-mas]'); if (ms) { const tr = ms.closest('tr'); abrirFila(tr, !tr.classList.contains('abierta')); }
    });
    cont.addEventListener('click', (e) => {
      const a = e.target.closest('[data-tfila]'); if (a) { agregar(Number(a.dataset.tfila) || 1); const tr = tb.rows[tb.rows.length - (Number(a.dataset.tfila) || 1)]; const el = tr && tr.querySelector('[data-k]'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } return; }
      const g = e.target.closest('[data-ir]'); if (g) ir(Number(g.dataset.ir));
    });
    $c('[data-tguardar]').addEventListener('click', async () => {
      intentado = true;
      const filas = revisar(), msg = $c('[data-tmsg]'), b = $c('[data-tguardar]');
      $c('[data-tfaltas]').innerHTML = faltasHTML(filas);
      if (!filas.length) { msg.textContent = 'Escribe al menos una fila.'; const el = tb.querySelector('[data-k]'); if (el) el.focus(); return; }
      const buenas = filas.filter((x) => !x.errores.length), malas = filas.length - buenas.length;
      if (malas) {
        ir(filas.find((x) => x.errores.length).n);
        if (!buenas.length) { msg.textContent = 'Corrige lo marcado en rojo para poder guardar.'; return; }
        if (!confirm(malas + ' fila(s) tienen algo por corregir y no se guardan todavía. ¿Guardar ya las ' + buenas.length + ' que están bien?')) { msg.textContent = 'Corrige lo marcado en rojo y vuelve a guardar.'; return; }
      }
      if (!navigator.onLine) { msg.textContent = 'Guardar la tabla necesita señal. Lo escrito queda guardado en este equipo.'; return; }
      b.disabled = true;
      const res = await guardarFilas(cfg, buenas, msg);
      b.disabled = false;
      // Lo que quedó guardado sale de la tabla; lo que falló o falta corregir se queda.
      const ok = new Set(res.okN);
      buenas.forEach((x) => { if (ok.has(x.n)) x.tr.remove(); });
      if (!tb.rows.length) agregar(1);
      numerar(); intentado = malas > 0 || res.fallas.length > 0;
      const f2 = revisar(); $c('[data-tfaltas]').innerHTML = intentado ? faltasHTML(f2) : '';
      msg.innerHTML = informe(res) + (malas ? '<br>Quedan en la tabla las filas por corregir.' : '');
      if (!intentado) $c('[data-borrador]').innerHTML = '';
      if (cfg.alTerminar && res.hechas) cfg.alTerminar(res.hechas);
    });
    window.addEventListener('resize', numerar);
    return { tb, revisar, poner: (i, k, v) => { while (tb.rows.length <= i) agregar(1); poner(tb.rows[i], cols.find((c) => c.k === k), v); revisar(); } };
  }

  /** En un registro que ya existe se manda solo lo que trae la fila (lo vacío no borra lo que había). */
  function soloLlenos(c, existe) {
    if (!existe) return c;
    const o = {}; Object.keys(c).forEach((k) => { const v = c[k]; if (v === '' || v == null || (Array.isArray(v) && !v.length) || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) return; o[k] = v; });
    return o;
  }
  /** Para armar ids estables a partir de texto (la misma fila vuelve al mismo registro). */
  function idDe(prefijo, ...partes) {
    const t = partes.map(norm).join('|');
    let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
    const legible = norm(partes[0]).toUpperCase().replace(/ /g, '-').slice(0, 24);
    return prefijo + '-' + (legible ? legible + '-' : '') + h.toString(36).toUpperCase();
  }
  return { abrir, leerTabla, fecha, numero, sino, cedula, analizar, procesar, convertir, idDe, norm, plantillaCSV, soloLlenos };
})();
