/* ============================================================
   empresa.js — Nisafe
   Generado con configurar-empresa.html el 24/10/2026, 5:01:31 a. m..
   Para cambiar algo, vuelve a abrir configurar-empresa.html en este sitio:
   el formulario carga estos mismos datos.
   ============================================================ */

const EMPRESA = {
  "habilitacion": {
    "requisitos": {
      "seguridad_social": {
        "nombre": "Pago de seguridad social (PILA)",
        "meses": 1
      },
      "induccion": {
        "nombre": "Inducción / reinducción en SST",
        "meses": 12
      },
      "medico": {
        "nombre": "Concepto médico ocupacional",
        "meses": 12,
        "apto": true
      },
      "alturas": {
        "nombre": "Curso de trabajo en alturas",
        "meses": 18
      },
      "confinados": {
        "nombre": "Curso de espacios confinados",
        "meses": 12
      },
      "izajes": {
        "nombre": "Certificación de izaje (rigger / operador)",
        "meses": 12
      },
      "electrico": {
        "nombre": "Competencia en riesgo eléctrico",
        "meses": 12
      },
      "caliente": {
        "nombre": "Capacitación en trabajo en caliente",
        "meses": 12
      }
    },
    "exigir": {
      "todos": [
        "seguridad_social",
        "induccion",
        "medico"
      ],
      "alturas": [
        "alturas"
      ],
      "confinados": [
        "confinados"
      ],
      "izajes": [
        "izajes"
      ],
      "electrico": [
        "electrico"
      ],
      "caliente": [
        "caliente"
      ]
    },
    "avisarDias": 15
  },
  "acceso": null,
  "multiempresa": true,
  "producto": "Portal SSTA",
  "nombre": "Nisafe",
  "nombreCorto": "NISAFE",
  "nit": "1018455016",
  "subtitulo": "Sistema de Gestión SST",
  "logo": "",
  "colorMarca": "#1f3b57",
  "formatos": {
    "SSTA-F-005": {
      "codigo": "SSTA-F-005",
      "titulo": "Control de asistencia a capacitación, eventos y reuniones",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-006": {
      "codigo": "SSTA-F-006",
      "titulo": "Inspección de EPP",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-007": {
      "codigo": "SSTA-F-007",
      "titulo": "Análisis de Trabajo Seguro (ATS)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-116": {
      "codigo": "SSTA-F-116",
      "titulo": "Permiso de trabajo en alturas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-117": {
      "codigo": "SSTA-F-117",
      "titulo": "Permiso de espacios confinados",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-118": {
      "codigo": "SSTA-F-118",
      "titulo": "Permiso de izajes de cargas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-119": {
      "codigo": "SSTA-F-119",
      "titulo": "Permiso de trabajo en caliente",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-147": {
      "codigo": "SSTA-F-147",
      "titulo": "Inspección de EPP de brigadistas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-149": {
      "codigo": "SSTA-F-149",
      "titulo": "Anexo de personal autorizado",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-180": {
      "codigo": "SSTA-F-180",
      "titulo": "Permiso de trabajo eléctrico",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-REPORTE": {
      "codigo": "SG-REPORTE",
      "titulo": "Reporte e investigación de actos, condiciones, incidentes y accidentes",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PLAN": {
      "codigo": "SG-PLAN",
      "titulo": "Plan de acción del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-HABILITACION": {
      "codigo": "SG-HABILITACION",
      "titulo": "Estado de habilitación del personal",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INSPECCION": {
      "codigo": "SG-INSPECCION",
      "titulo": "Inspección planeada / preoperacional",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INVENTARIO": {
      "codigo": "SG-INVENTARIO",
      "titulo": "Inventario de equipos e inspecciones",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INDICADORES": {
      "codigo": "SG-INDICADORES",
      "titulo": "Informe de indicadores del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-COMITE-CONFORMACION": {
      "codigo": "SG-COMITE-CONFORMACION",
      "titulo": "Conformación de comités (COPASST / Convivencia)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-EMERGENCIAS-ACTA": {
      "codigo": "SG-EMERGENCIAS-ACTA",
      "titulo": "Acta de reunión del comité de emergencias",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-COPASST-ACTA": {
      "codigo": "SG-COPASST-ACTA",
      "titulo": "Acta de reunión del COPASST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONVIVENCIA-ACTA": {
      "codigo": "SG-CONVIVENCIA-ACTA",
      "titulo": "Acta de reunión del Comité de Convivencia Laboral",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONVIVENCIA-QUEJA": {
      "codigo": "SG-CONVIVENCIA-QUEJA",
      "titulo": "Expediente de queja (Comité de Convivencia)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONVIVENCIA-INFORME": {
      "codigo": "SG-CONVIVENCIA-INFORME",
      "titulo": "Informe de gestión del Comité de Convivencia",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-AUDITORIA": {
      "codigo": "SG-AUDITORIA",
      "titulo": "Informe de auditoría del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-AUDITORIA-PROGRAMA": {
      "codigo": "SG-AUDITORIA-PROGRAMA",
      "titulo": "Programa anual de auditorías",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PLAN-ANUAL": {
      "codigo": "SG-PLAN-ANUAL",
      "titulo": "Plan anual de trabajo del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PLAN-CAPACITACION": {
      "codigo": "SG-PLAN-CAPACITACION",
      "titulo": "Plan de capacitación",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-MATRIZ-PELIGROS": {
      "codigo": "SG-MATRIZ-PELIGROS",
      "titulo": "Matriz de identificación de peligros y valoración de riesgos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-SUSTANCIAS": {
      "codigo": "SG-SUSTANCIAS",
      "titulo": "Inventario de sustancias químicas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PLAN-EMERGENCIAS": {
      "codigo": "SG-PLAN-EMERGENCIAS",
      "titulo": "Plan de prevención, preparación y respuesta ante emergencias",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-SIMULACRO": {
      "codigo": "SG-SIMULACRO",
      "titulo": "Informe de simulacro",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROFESIOGRAMA": {
      "codigo": "SG-PROFESIOGRAMA",
      "titulo": "Profesiograma",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-EXAMENES": {
      "codigo": "SG-EXAMENES",
      "titulo": "Programación de evaluaciones médicas ocupacionales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-AUSENTISMO": {
      "codigo": "SG-AUSENTISMO",
      "titulo": "Informe de ausentismo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-POLITICA": {
      "codigo": "SG-POLITICA",
      "titulo": "Política de seguridad y salud en el trabajo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-MATRIZ-LEGAL": {
      "codigo": "SG-MATRIZ-LEGAL",
      "titulo": "Matriz de requisitos legales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-LISTADO-MAESTRO": {
      "codigo": "SG-LISTADO-MAESTRO",
      "titulo": "Listado maestro de documentos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROVEEDORES": {
      "codigo": "SG-PROVEEDORES",
      "titulo": "Evaluación de proveedores y contratistas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-EVAL-PROVEEDOR": {
      "codigo": "SG-EVAL-PROVEEDOR",
      "titulo": "Evaluación y reevaluación de proveedores, contratistas y subcontratistas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-REVISION-DIRECCION": {
      "codigo": "SG-REVISION-DIRECCION",
      "titulo": "Revisión por la alta dirección",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-RENDICION": {
      "codigo": "SG-RENDICION",
      "titulo": "Rendición de cuentas en SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONTRATISTA": {
      "codigo": "SG-CONTRATISTA",
      "titulo": "Ficha y documentos del contratista",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INGRESO-CONTRATISTA": {
      "codigo": "SG-INGRESO-CONTRATISTA",
      "titulo": "Control de ingreso de contratistas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-MATRIZ-EPP": {
      "codigo": "SG-MATRIZ-EPP",
      "titulo": "Matriz de elementos de protección personal por cargo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-ENTREGA-EPP": {
      "codigo": "SG-ENTREGA-EPP",
      "titulo": "Registro de entrega de elementos de protección personal",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INDUCCION": {
      "codigo": "SG-INDUCCION",
      "titulo": "Inducción y reinducción en SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROGRAMA-ALTO-RIESGO": {
      "codigo": "SG-PROGRAMA-ALTO-RIESGO",
      "titulo": "Programas de tareas de alto riesgo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PESV": {
      "codigo": "SG-PESV",
      "titulo": "Plan estratégico de seguridad vial",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-TABLERO-GERENCIA": {
      "codigo": "SG-TABLERO-GERENCIA",
      "titulo": "Informe del SG-SST para la gerencia",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-REPORTE-ANUAL-0312": {
      "codigo": "SG-REPORTE-ANUAL-0312",
      "titulo": "Reporte anual de estándares mínimos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-ASPECTOS-AMBIENTALES": {
      "codigo": "SG-ASPECTOS-AMBIENTALES",
      "titulo": "Matriz de aspectos e impactos ambientales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-RESIDUOS": {
      "codigo": "SG-RESIDUOS",
      "titulo": "Registro de generación de residuos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INFORME-ASESORIA": {
      "codigo": "SG-INFORME-ASESORIA",
      "titulo": "Informe de asesoría en SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-COMPATIBILIDAD": {
      "codigo": "SG-COMPATIBILIDAD",
      "titulo": "Matriz de compatibilidad de sustancias químicas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-GESTION-QUIMICA": {
      "codigo": "SG-GESTION-QUIMICA",
      "titulo": "Gestión del riesgo químico (SGA)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-LUGARES-QUIMICOS": {
      "codigo": "SG-LUGARES-QUIMICOS",
      "titulo": "Lugares de almacenamiento de sustancias químicas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONSUMOS": {
      "codigo": "SG-CONSUMOS",
      "titulo": "Informe de consumos de agua, energía y combustibles",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CRONOGRAMA-INSP": {
      "codigo": "SG-CRONOGRAMA-INSP",
      "titulo": "Cronograma de inspecciones",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-OBJETIVOS": {
      "codigo": "SG-OBJETIVOS",
      "titulo": "Objetivos del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-DESIGNACION": {
      "codigo": "SG-DESIGNACION",
      "titulo": "Designación del responsable del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-ROLES": {
      "codigo": "SG-ROLES",
      "titulo": "Roles y responsabilidades en el SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-RECURSOS": {
      "codigo": "SG-RECURSOS",
      "titulo": "Asignación de recursos para el SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-REGLAMENTO": {
      "codigo": "SG-REGLAMENTO",
      "titulo": "Reglamento de higiene y seguridad industrial",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-PELIGROS": {
      "codigo": "SG-PROC-PELIGROS",
      "titulo": "Procedimiento de identificación de peligros, evaluación y valoración de riesgos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-INVESTIGACION": {
      "codigo": "SG-PROC-INVESTIGACION",
      "titulo": "Procedimiento de reporte e investigación de incidentes, accidentes de trabajo y enfermedades laborales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-ACCIONES": {
      "codigo": "SG-PROC-ACCIONES",
      "titulo": "Procedimiento de acciones correctivas, preventivas y de mejora",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-CAMBIO": {
      "codigo": "SG-PROC-CAMBIO",
      "titulo": "Procedimiento de gestión del cambio",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-AUDITORIA": {
      "codigo": "SG-PROC-AUDITORIA",
      "titulo": "Procedimiento de auditoría interna del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-REVISION": {
      "codigo": "SG-PROC-REVISION",
      "titulo": "Procedimiento de revisión por la alta dirección",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-DOCUMENTOS": {
      "codigo": "SG-PROC-DOCUMENTOS",
      "titulo": "Procedimiento de control de documentos y conservación de registros",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-COMUNICACION": {
      "codigo": "SG-PROC-COMUNICACION",
      "titulo": "Procedimiento de comunicación, participación y consulta",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-COMPRAS": {
      "codigo": "SG-PROC-COMPRAS",
      "titulo": "Procedimiento de adquisiciones y contratación con criterios de SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-EMERGENCIAS": {
      "codigo": "SG-PROC-EMERGENCIAS",
      "titulo": "Procedimiento de prevención, preparación y respuesta ante emergencias",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROG-CAPACITACION": {
      "codigo": "SG-PROG-CAPACITACION",
      "titulo": "Programa de capacitación, inducción y reinducción en SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROG-INSPECCIONES": {
      "codigo": "SG-PROG-INSPECCIONES",
      "titulo": "Programa de inspecciones planeadas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROG-MEDICO": {
      "codigo": "SG-PROG-MEDICO",
      "titulo": "Programa de evaluaciones médicas ocupacionales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-MANUAL": {
      "codigo": "SG-MANUAL",
      "titulo": "Manual del Sistema de Gestión de la Seguridad y Salud en el Trabajo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONTEXTO": {
      "codigo": "SG-CONTEXTO",
      "titulo": "Contexto de la organización (DOFA y partes interesadas)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-RIESGOS-CALIDAD": {
      "codigo": "SG-RIESGOS-CALIDAD",
      "titulo": "Matriz de riesgos y oportunidades",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-OBJETIVOS-CALIDAD": {
      "codigo": "SG-OBJETIVOS-CALIDAD",
      "titulo": "Objetivos e indicadores de calidad",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PNC": {
      "codigo": "SG-PNC",
      "titulo": "Registro de producto o servicio no conforme",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PQRS": {
      "codigo": "SG-PQRS",
      "titulo": "Informe de PQRS de clientes",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-SATISFACCION": {
      "codigo": "SG-SATISFACCION",
      "titulo": "Encuesta e informe de satisfacción del cliente",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PREOPERACIONAL": {
      "codigo": "SG-PREOPERACIONAL",
      "titulo": "Inspección preoperacional",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CIERRE-MES": {
      "codigo": "SG-CIERRE-MES",
      "titulo": "Informe mensual del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-EVIDENCIAS": {
      "codigo": "SG-EVIDENCIAS",
      "titulo": "Índice de evidencias del SG-SST por estándar",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-ETIQUETAS-QR": {
      "codigo": "SG-ETIQUETAS-QR",
      "titulo": "Etiquetas QR de equipos e instalaciones",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    }
  },
  "modulos": {
    "caliente": true,
    "alturas": true,
    "confinados": true,
    "izajes": true,
    "electrico": true,
    "ats": true,
    "preop": true,
    "epp": true,
    "brigadistas": true,
    "personal": true,
    "asistencia": true,
    "tablero": true,
    "habilitacion": true,
    "induccion": true,
    "dotacion": true,
    "contratistas": true,
    "salud": true,
    "plananual": true,
    "peligros": true,
    "documental": true,
    "kit": true,
    "programas": true,
    "quimicos": true,
    "pesv": true,
    "reportes": true,
    "inspecciones": true,
    "emergencias": true,
    "comiteemergencias": true,
    "ambiental": true,
    "proveedores": true,
    "copasst": true,
    "convivencia": true,
    "indicadores": true,
    "auditorias": true,
    "evidencias": true,
    "cierre": true,
    "gerencia": true,
    "plan": true,
    "revision": true,
    "calidad": true,
    "usuarios": true,
    "asesor": true
  },
  "correos": {
    "aprobacionEpp": "",
    "dominio": ""
  },
  "privacidad": {
    "correo": "",
    "politica": ""
  },
  "contactoEpp": {
    "nombre": "",
    "cargo": "",
    "whatsapp": ""
  },
  "centrosCosto": [],
  "servidor": "https://script.google.com/macros/s/AKfycbzb1Y6IuOmkLN0_O9pOCa7ouNk_lArw0NnHqkjeKqBQI1GaWheClAOp2GhEUjJ1qKE/exec",
  "apiToken": "cHYFBcA7Ckqdmb7Cw9EtG5owhsZ8VumYFJqf9hx9",
  "demo": false,
  "empresaPorDefecto": ""
};
