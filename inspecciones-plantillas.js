/* ============================================================
   inspecciones-plantillas.js — Listas de chequeo de las inspecciones
   ------------------------------------------------------------
   Se editan aquí sin tocar la página. Cada plantilla:
     id          — no se cambia una vez en uso (queda en los registros)
     nombre      — lo que se ve
     icono
     equipo      — true: se inspecciona un equipo del inventario (con código);
                   false: se inspecciona un área o un frente de trabajo
     frecuencia  — sugerida para los equipos nuevos de esta categoría
     vencimientos— fechas que se controlan en el inventario (recarga, SOAT…)
     items       — las preguntas. Se responden C (cumple) / NC / NA.
                   Una NC pide observación y foto, y se vuelve acción del
                   plan de acción.
     preoperacional — true: el resultado se lee "apto / no apto para usar"
   Las preguntas siguen las listas de chequeo usuales (NTC 2885 para
   extintores, Res. 4272 de 2021 para equipos de alturas…). Son una base:
   ajústalas a los formatos de la empresa.
   ============================================================ */
const PLANTILLAS_INSPECCION = [
  { id: 'extintor', nombre: 'Extintor', icono: '🧯', equipo: true, frecuencia: 'mensual', vencimientos: ['Recarga', 'Prueba hidrostática'], items: [
    'Ubicado en el sitio asignado, visible y señalizado',
    'Acceso libre de obstáculos',
    'Altura de instalación adecuada (parte superior a máx. 1,5 m del piso)',
    'Manómetro en zona verde (presión correcta)',
    'Pasador de seguridad y sello en su lugar',
    'Manguera y boquilla en buen estado, sin obstrucciones',
    'Cilindro sin golpes, corrosión ni fugas',
    'Etiqueta de recarga legible y vigente',
    'Instrucciones de uso legibles',
    'Tipo de extintor adecuado para el riesgo del área'] },
  { id: 'botiquin', nombre: 'Botiquín', icono: '🩹', equipo: true, frecuencia: 'mensual', vencimientos: ['Insumo más próximo a vencer'], items: [
    'Ubicado en sitio visible, señalizado y de fácil acceso',
    'Limpio, ordenado y en buen estado',
    'Gasas, vendas y apósitos completos',
    'Esparadrapo / cinta microporosa',
    'Guantes desechables',
    'Solución salina y antiséptico',
    'Tijeras, termómetro y linterna',
    'Inmovilizadores / collar cervical (si aplica)',
    'Ningún insumo vencido',
    'Registro de uso de insumos al día'] },
  { id: 'camilla', nombre: 'Camilla y equipo de emergencia', icono: '🚑', equipo: true, frecuencia: 'trimestral', vencimientos: [], items: [
    'Ubicada en sitio señalizado y de fácil acceso',
    'Estructura sin fisuras ni deformaciones',
    'Correas de sujeción completas y en buen estado',
    'Inmovilizador de cabeza disponible',
    'Limpia y lista para usar'] },
  { id: 'arnes', nombre: 'Arnés y equipo contra caídas', icono: '🪢', equipo: true, frecuencia: 'mensual', preoperacional: true, vencimientos: ['Inspección certificada anual', 'Vida útil (fabricante)'], items: [
    'Etiqueta del fabricante legible (serial, fecha, norma)',
    'Reatas sin cortes, quemaduras, deshilachados ni decoloración',
    'Costuras completas, sin hilos sueltos ni rotos',
    'Argollas en D sin deformación, fisuras ni corrosión',
    'Hebillas y ajustes funcionan correctamente',
    'Indicador de impacto sin activar',
    'Eslinga / absorbedor sin activación ni daños',
    'Ganchos con doble seguro que cierran solos',
    'Sin contacto con químicos, pintura o soldadura',
    'Almacenado limpio, seco y colgado'] },
  { id: 'escalera', nombre: 'Escalera', icono: '🪜', equipo: true, frecuencia: 'mensual', preoperacional: true, vencimientos: [], items: [
    'Largueros sin fisuras, dobleces ni astillas',
    'Peldaños completos, firmes y antideslizantes',
    'Zapatas antideslizantes en buen estado',
    'Tensores / bisagras / seguros en buen estado (tijera)',
    'Etiqueta de capacidad de carga visible',
    'Limpia, sin grasa, aceite ni pintura',
    'Material adecuado para la tarea (dieléctrica si hay riesgo eléctrico)'] },
  { id: 'andamio', nombre: 'Andamio', icono: '🏗️', equipo: true, frecuencia: 'semanal', preoperacional: true, vencimientos: [], items: [
    'Base nivelada sobre superficie firme; tornillos niveladores / placas base',
    'Crucetas y diagonales completas y aseguradas',
    'Plataformas completas, ajustadas y con seguro',
    'Barandas superior e intermedia y rodapié en toda la plataforma',
    'Acceso seguro (escalera interna o de gato)',
    'Ruedas con freno (si es móvil)',
    'Anclado a estructura si supera la relación altura/base',
    'Sin piezas oxidadas, dobladas o soldadas',
    'Tarjeta de inspección (verde/roja) visible',
    'Área inferior señalizada y demarcada'] },
  { id: 'herramienta_electrica', nombre: 'Herramienta eléctrica (pulidora, taladro, esmeril…)', icono: '🔌', equipo: true, frecuencia: 'diaria', preoperacional: true, vencimientos: [], items: [
    'Cable y clavija sin empalmes, cortes ni partes expuestas',
    'Carcasa sin fisuras, tornillos completos',
    'Guarda de protección instalada y bien ajustada',
    'Interruptor funciona y no queda trabado',
    'Disco / broca / accesorio adecuado, sin fisuras y dentro de la fecha',
    'Mango auxiliar instalado (pulidora)',
    'RPM del disco compatibles con la herramienta',
    'Llave del mandril / herramientas de ajuste disponibles',
    'Se conecta a tomacorriente con polo a tierra / GFCI'] },
  { id: 'soldadura', nombre: 'Equipo de soldadura eléctrica', icono: '⚡', equipo: true, frecuencia: 'diaria', preoperacional: true, vencimientos: [], items: [
    'Cables de alimentación y de soldar sin daños ni empalmes expuestos',
    'Pinza portaelectrodo con aislamiento completo',
    'Pinza de tierra firme y bien conectada',
    'Carcasa y conexiones sin daños; polo a tierra',
    'Interruptor y perillas funcionan',
    'Extintor a menos de 10 m',
    'Biombo / pantalla para proteger a terceros',
    'Área sin materiales combustibles'] },
  { id: 'oxicorte', nombre: 'Equipo de oxicorte', icono: '🔥', equipo: true, frecuencia: 'diaria', preoperacional: true, vencimientos: ['Prueba hidrostática cilindros'], items: [
    'Cilindros en posición vertical, asegurados con cadena',
    'Capuchón de protección disponible',
    'Reguladores y manómetros en buen estado',
    'Válvulas antirretroceso (arresta llamas) instaladas en ambos extremos',
    'Mangueras sin fisuras, quemaduras ni empalmes con cinta',
    'Abrazaderas adecuadas (no alambre)',
    'Prueba de fugas con agua jabonosa sin fugas',
    'Soplete y boquillas en buen estado',
    'Chispero disponible (no se enciende con fósforo o encendedor)',
    'Extintor a menos de 10 m'] },
  { id: 'vehiculo', nombre: 'Vehículo', icono: '🚚', equipo: true, frecuencia: 'diaria', preoperacional: true, vencimientos: ['SOAT', 'Revisión técnico-mecánica', 'Licencia del conductor'], items: [
    'Luces (altas, bajas, direccionales, stop, reversa) funcionan',
    'Frenos de servicio y de parqueo funcionan',
    'Llantas con labrado y presión adecuados; repuesto en buen estado',
    'Niveles de aceite, refrigerante y líquido de frenos',
    'Cinturones de seguridad funcionan',
    'Espejos y vidrios completos y limpios',
    'Pito y alarma de reversa funcionan',
    'Kit de carretera y botiquín completos',
    'Extintor vigente y asegurado',
    'Documentos al día y en el vehículo'] },
  { id: 'locativa', nombre: 'Inspección locativa (área de trabajo)', icono: '🏢', equipo: true, frecuencia: 'mensual', vencimientos: [], items: [
    'Orden y aseo; pasillos y salidas despejados',
    'Pisos sin huecos, desniveles ni superficies resbalosas',
    'Señalización de rutas de evacuación y salidas visible',
    'Iluminación suficiente',
    'Instalaciones eléctricas sin cables expuestos ni tomas sobrecargadas',
    'Tableros eléctricos cerrados y señalizados',
    'Almacenamiento seguro (estibas, estanterías ancladas, sin sobrepeso)',
    'Sustancias químicas rotuladas, con hoja de seguridad y en contención',
    'Equipos de emergencia (extintor, botiquín, camilla) accesibles',
    'Puntos ecológicos y manejo de residuos adecuados',
    'Barandas en escaleras y bordes',
    'Ventilación adecuada'] },
  { id: 'quimicos', nombre: 'Almacenamiento de sustancias químicas', icono: '⚗️', equipo: true, frecuencia: 'mensual', vencimientos: [], items: [
    'Inventario de sustancias del área actualizado (Res. 773 de 2021, art. 21)',
    'Todos los envases con etiqueta SGA legible (pictogramas, palabra de advertencia, indicaciones de peligro)',
    'Envases secundarios (trasvases) rotulados con el nombre del producto y sus peligros',
    'Fichas de datos de seguridad en español disponibles en el sitio de uso',
    'Incompatibles separados según la matriz de compatibilidad',
    'Recipientes cerrados, sin fugas, golpes ni corrosión',
    'Contención secundaria (dique o bandeja) para los líquidos',
    'Kit antiderrames completo y accesible',
    'Ducha o lavaojos operativos donde hay corrosivos o irritantes',
    'Ventilación adecuada; sin olores fuertes acumulados',
    'Señalización de peligros y de prohibido fumar',
    'Extintor adecuado para el riesgo, vigente y a la mano',
    'EPP indicado en la ficha de datos de seguridad disponible y en buen estado',
    'Sin alimentos, bebidas ni objetos personales en el área',
    'Estanterías firmes, ancladas; lo más pesado y los líquidos abajo'] },
  { id: 'electrica', nombre: 'Instalaciones eléctricas', icono: '💡', equipo: true, frecuencia: 'trimestral', vencimientos: [], items: [
    'Tableros cerrados, señalizados (riesgo eléctrico) y con acceso libre (mín. 1 m)',
    'Circuitos del tablero identificados',
    'Sin cables expuestos, empalmes con cinta ni conductores sueltos',
    'Tomacorrientes y clavijas en buen estado, sin quemaduras',
    'Sin multitomas en cascada ni extensiones como instalación permanente',
    'Polo a tierra en tomas y equipos que lo requieren',
    'Interruptores diferenciales (GFCI) en zonas húmedas',
    'Canaletas y tuberías completas y fijas',
    'Iluminación de emergencia funciona',
    'Equipos eléctricos sin sobrecalentamiento ni ruidos anormales',
    'Herramientas y equipos de trabajo eléctrico (dieléctricos) en buen estado'] }
];
/* Tipos de inspección: la rutinaria la hace el responsable del área; la gerencial,
   la alta dirección; la del COPASST, sus integrantes (Decreto 1072 de 2015, art.
   2.2.4.6.12 y Res. 2013 de 1986). En gerenciales y del COPASST se anotan los
   participantes. La preoperacional sale sola en las listas que lo son. */
const TIPOS_INSPECCION = ['Rutinaria', 'Gerencial', 'COPASST', 'Preoperacional'];
const CON_PARTICIPANTES = ['Gerencial', 'COPASST'];
const ICONOS_INSPECCION = ['📋', '🧯', '🩹', '🚑', '🪢', '🪜', '🏗️', '🔌', '⚡', '🔥', '🚚', '🏢', '⚗️', '💡', '🧹', '🍽️', '📦', '🛠️', '🦺', '🚧', '🏭', '🚻', '🌳', '🖥️'];
/** Une las listas del código con las de la empresa (registros "plantillainsp"):
 *  — una con "reemplaza" toma el lugar de la original (mismo id: el inventario y el
 *    historial siguen igual); si se desactiva, vuelve la original;
 *  — las demás son listas propias (su id es el del registro).
 *  Cada lista sale con origen: 'original' | 'ajustada' | 'propia', y activa. */
function plantillasInspeccion(propias){
  const lineas = (t)=> String(t || '').split(/\n/).map((x)=> x.trim()).filter(Boolean);
  const out = PLANTILLAS_INSPECCION.map((p)=> Object.assign({}, p, { origen: 'original', activa: true }));
  (propias || []).forEach((x)=> {
    const r = x.resumen || {}; if (x.borrado) return;
    const def = { nombre: r.nombre || 'Lista sin nombre', icono: ICONOS_INSPECCION.indexOf(r.icono) !== -1 ? r.icono : '📋', equipo: true, frecuencia: FRECUENCIAS[r.frecuencia] ? r.frecuencia : 'mensual',
      preoperacional: r.preoperacional === true, vencimientos: lineas(r.vencimientosTexto), items: lineas(r.itemsTexto), docId: x.id, activa: r.activa !== false };
    if (!def.items.length) return;
    if (r.reemplaza) {
      const i = out.findIndex((p)=> p.id === r.reemplaza && p.origen === 'original');
      if (i !== -1 && def.activa) out[i] = Object.assign({}, def, { id: r.reemplaza, origen: 'ajustada', original: PLANTILLAS_INSPECCION.find((p)=> p.id === r.reemplaza) });
      else if (i !== -1) out[i].docAjuste = x.id;   // ajuste desactivado: se puede volver a activar
    } else out.push(Object.assign(def, { id: x.id, origen: 'propia' }));
  });
  return out;
}
const FRECUENCIAS = { diaria: { nombre: 'Diaria', dias: 1 }, semanal: { nombre: 'Semanal', dias: 7 }, quincenal: { nombre: 'Quincenal', dias: 15 },
  mensual: { nombre: 'Mensual', meses: 1 }, bimestral: { nombre: 'Bimestral', meses: 2 }, trimestral: { nombre: 'Trimestral', meses: 3 },
  semestral: { nombre: 'Semestral', meses: 6 }, anual: { nombre: 'Anual', meses: 12 } };
