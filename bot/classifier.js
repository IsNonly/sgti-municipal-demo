// ===== SGTI Municipal — Clasificador Inteligente de Mensajes =====
// Analiza mensajes de WhatsApp y los clasifica por área, categoría y prioridad.
// Soporta derivación múltiple cuando un mensaje coincide con varias áreas.
const { GrupoVinculado } = require('../database/models');

// Cache para grupos vinculados manualmente (se actualiza periódicamente o bajo demanda)
let CACHE_GRUPOS_VINCULADOS = {};

/**
 * Sincroniza el cache de grupos desde la base de datos
 */
async function syncGruposVinculados() {
  try {
    const { GrupoVinculado } = require('../database/models');
    const vinculados = await GrupoVinculado.findAll(); // Traer todos para saber cuáles ignorar explícitamente
    const nuevoCache = {};
    vinculados.forEach(v => {
      nuevoCache[v.remoteId] = { areaId: v.areaId, monitoreado: v.monitoreado };
      if (v.monitoreado) console.log(`🔗 Grupo Vinculado: ${v.remoteId} -> ${v.areaId}`);
    });
    CACHE_GRUPOS_VINCULADOS = nuevoCache;
    console.log(`🔄 Cache de grupos sincronizado: ${Object.keys(nuevoCache).length} registros.`);
  } catch (e) {
    console.error('⚠️ Error sincronizando CACHE_GRUPOS_VINCULADOS:', e.message);
  }
}

// Sincronizar al iniciar y cada 5 minutos
syncGruposVinculados();
setInterval(syncGruposVinculados, 5 * 60 * 1000);

// ===== CONFIGURACIÓN DE GRUPOS DE WHATSAPP =====
// Mapeo flexible: si el nombre del grupo contiene alguna de estas keywords, se asocia al área
const GRUPOS_CONFIG = {
  seguridad: {
    keywords: ['serenazgo', 'seguridad', 'patrullaje', 'vigilancia', 'patrulla', 'fiscalización', 'fiscalizacion', 'sanciones', 'clausura', 'bomberos', 'ambulancia', 'emergencia', 'transporte'],
    nombre: 'Seguridad Ciudadana',
    icon: '🛡️',
    color: 'blue'
  },
  ambiental: {
    keywords: ['limpieza', 'basura', 'ambiental', 'residuos', 'recojo', 'parques', 'jardines'],
    nombre: 'Desarrollo Ambiental',
    icon: '🌿',
    color: 'green'
  },
  rentas: {
    keywords: ['rentas', 'licencia', 'tributo', 'impuesto', 'recaudación', 'recaudacion', 'fiscalización tributaria', 'fiscalizacion tributaria', 'coactivo', 'ejecución', 'desarrollo económico'],
    nombre: 'Rentas',
    icon: '💰',
    color: 'amber'
  },
  urbano: {
    keywords: ['obras', 'urbanismo', 'catastro', 'infraestructura', 'desarrollo urbano', 'pistas', 'veredas', 'ornado', 'ornato'],
    nombre: 'Desarrollo Urbano',
    icon: '🏗️',
    color: 'orange'
  },
  municipal: {
    keywords: ['municipal', 'alcaldía', 'alcaldia', 'general', 'documento', 'trámite', 'queja general', 'municipalidad', 'rescate'],
    nombre: 'Gerencia Municipal',
    icon: '🏛️',
    color: 'blue'
  },
  humano: {
    keywords: ['vaso de leche', 'comedor', 'adulto mayor', 'pension 65', 'salud', 'educación', 'vacunación'],
    nombre: 'Desarrollo Humano',
    icon: '👥',
    color: 'purple'
  },
  participacion: {
    keywords: ['participación', 'participacion', 'vecinal'],
    nombre: 'Participación Vecinal',
    icon: '🤝',
    color: 'indigo'
  },
  opc: {
    keywords: ['opc', 'junta vecinal', 'organizaciones sociales'],
    nombre: 'Participación (OPC)',
    icon: '🏛️',
    color: 'blue'
  },
  demuna: {
    keywords: ['demuna', 'niñez', 'adolescencia'],
    nombre: 'DEMUNA',
    icon: '⚖️',
    color: 'red'
  },
  ciam: {
    keywords: ['ciam', 'adulto mayor'],
    nombre: 'CIAM',
    icon: '👴',
    color: 'green'
  },
  omaped: {
    keywords: ['omaped', 'discapacidad'],
    nombre: 'OMAPED',
    icon: '♿',
    color: 'amber'
  },
  otros: {
    keywords: [], // Fallback cuando nadie lo reconoce
    nombre: 'Otros / Sin Clasificar',
    icon: '❓',
    color: 'gray'
  }
};

// ===== DICCIONARIO DE INCIDENCIAS (SISTEMA DE ALTA PRECISIÓN) =====
const INCIDENCIAS = [
  // ── SEGURIDAD CIUDADANA (PRIORIDAD ALTA EN CLASIFICACIÓN) ──
  { categoria: 'Comercio Informal', keywords: ['ambulante', 'ambulantes', 'triciclo', 'triciclero', 'limpialunas', 'limpia lunas', 'comercio ilegal', 'comercio informal', 'venta en la calle', 'erradicación', 'erradicacion', 'erradicado', 'retirado de la vía'], prioridad: 'Media', areas: ['seguridad'] },
  { categoria: 'Robo / Asalto', keywords: ['robo', 'asalto', 'asaltaron', 'me robaron', 'arma', 'cuchillo', 'pistola', 'ladrón', 'ladron', 'cogoteo', 'arrebato', 'bir', 'grupo bir'], prioridad: 'Alta', areas: ['seguridad'] },
  { categoria: 'Vehículo Abandonado', keywords: ['vehículo abandonado', 'vehiculo abandonado', 'carro abandonado', 'auto abandonado', 'moto abandonada', 'sin placa', 'unidad abandonada'], prioridad: 'Baja', areas: ['seguridad'] },
  { categoria: 'Pelea Callejera', keywords: ['pelea', 'gresca', 'golpiza', 'bronca', 'riña', 'pandilla', 'pandilleros', 'agresión', 'agresion', 'pelean', 'golpes'], prioridad: 'Alta', areas: ['seguridad'] },
  { categoria: 'Persona Sospechosa', keywords: ['sospechoso', 'sospechosa', 'raro', 'merodeando', 'vigilando casas', 'mirando carros'], prioridad: 'Media', areas: ['seguridad'] },
  { categoria: 'Ruido Excesivo', keywords: ['ruido', 'bulla', 'música fuerte', 'musica fuerte', 'fiesta', 'volumen alto', 'escándalo', 'escandalo'], prioridad: 'Baja', areas: ['seguridad'] },
  { categoria: 'Seguridad Vial', keywords: ['accidente', 'choque', 'atropello', 'semáforo', 'señalización', 'tránsito', 'transito'], prioridad: 'Media', areas: ['seguridad', 'urbano'] },

  // ── DESARROLLO URBANO (OBRAS Y CATASTRO) ──
  { categoria: 'Obras Públicas', keywords: ['obra', 'obras', 'construcción', 'construccion', 'gerente de obras', 'jhony romero', 'puesto de vigilancia', 'pistas', 'veredas', 'infraestructura', 'mezcladora', 'cemento'], prioridad: 'Media', areas: ['urbano'] },
  { categoria: 'Pista/Vereda Dañada', keywords: ['hueco', 'pista rota', 'vereda rota', 'bache', 'pavimento', 'cráter', 'hundido'], prioridad: 'Media', areas: ['urbano'] },
  { categoria: 'Alumbrado Público', keywords: ['alumbrado', 'poste', 'foco', 'oscuro', 'sin luz', 'iluminación'], prioridad: 'Media', areas: ['urbano'] },
  { categoria: 'Construcción Irregular', keywords: ['construcción ilegal', 'sin permiso de obra', 'invasión', 'invasion', 'construyendo sin'], prioridad: 'Alta', areas: ['urbano', 'seguridad'] },
  { categoria: 'Ornato y Mantenimiento', keywords: ['ornato', 'ornado', 'pintado', 'pinta de postes', 'limpieza de parque', 'mantenimiento urbano', 'arreglo de plaza'], prioridad: 'Baja', areas: ['urbano'] },

  // ── RENTAS ──
  { categoria: 'Gestión de Rentas', keywords: ['rentas', 'licencia', 'tributo', 'impuesto', 'recaudación', 'fiscalización tributaria', 'inspección tributaria', 'giro no autorizado', 'certificado de itsdc', 'itse', 'permiso de letrero'], prioridad: 'Media', areas: ['rentas', 'seguridad'] },

  // ── DESARROLLO AMBIENTAL (LIMPIEZA Y CUIDADO) ──
  { categoria: 'Basura Acumulada', keywords: ['basura', 'basural', 'desperdicios', 'sucio', 'olor', 'hedor', 'recojo', 'bolsas de basura'], prioridad: 'Media', areas: ['ambiental'] },
  { categoria: 'Desmonte', keywords: ['desmonte', 'escombros', 'cascajo', 'material de desechos', 'botadero'], prioridad: 'Media', areas: ['ambiental'] },
  { categoria: 'Área Verde', keywords: ['parque', 'jardín', 'jardin', 'poda', 'área verde', 'area verde', 'árbol', 'arbol', 'maleza', 'pasto'], prioridad: 'Baja', areas: ['ambiental'] },
  { categoria: 'Sanidad y Zoonosis', keywords: ['perro callejero', 'animal callejero', 'rabia', 'zoonosis', 'mordedura', 'perro agresivo', 'riesgo sanitario', 'animal muerto'], prioridad: 'Alta', areas: ['ambiental'] },

  // ── PARTICIPACIÓN VECINAL Y TEMAS SOCIALES ──
  { categoria: 'OPC (Participación)', keywords: ['opc', 'organizaciones sociales', 'junta vecinal', 'vecinos organizados', 'comité', 'comite'], prioridad: 'Media', areas: ['participacion'] },
  { categoria: 'DEMUNA', keywords: ['demuna', 'niñez', 'adolescencia', 'menor de edad', 'maltrato infantil', 'defensoría', 'defensoria'], prioridad: 'Alta', areas: ['participacion'] },
  { categoria: 'CIAM (Adulto Mayor)', keywords: ['ciam', 'adulto mayor', 'abuelito', 'anciano', 'tercera edad', 'pensión 65', 'pension 65'], prioridad: 'Media', areas: ['participacion'] },
  { categoria: 'OMAPED (Discapacidad)', keywords: ['omaped', 'discapacidad', 'habilidades diferentes', 'silla de ruedas', 'carnet conadis', 'conadis'], prioridad: 'Media', areas: ['participacion'] },
  { categoria: 'Vaso de Leche / Comedor', keywords: ['vaso de leche', 'comedor', 'alimentos', 'canasta social'], prioridad: 'Media', areas: ['participacion', 'humano'] },

  // ── DESARROLLO HUMANO (GENERAL / SALUD) ──
  { categoria: 'Apoyo Social', keywords: ['ayuda social', 'donación', 'donacion', 'vulnerable', 'pobreza extremo'], prioridad: 'Media', areas: ['humano', 'municipal'] },
  { categoria: 'Bienestar Animal (Patitas)', keywords: ['perro', 'gato', 'animal', 'jueves de patitas', 'desparasitación', 'desparasitacion', 'campaña canina', 'campana canina', 'patitas', 'veterinaria municipal'], prioridad: 'Media', areas: ['humano'] },
  { categoria: 'Atención Médica', keywords: ['infarto', 'convulsión', 'desmayado', 'inconsciente', 'no respira', 'herido de bala', 'sangrado'], prioridad: 'Alta', areas: ['seguridad', 'humano'] },
];

// ===== KEYWORDS DE PRIORIDAD =====
const PRIORIDAD_OVERRIDE = {
  Alta: ['urgente', 'urgencia', 'emergencia', 'auxilio', 'ayuda', 'socorro', 'herido', 'muerto', 'arma', 'peligro', 'rápido', 'rapido'],
  Baja: ['consulta', 'información', 'sugerencia', 'completado', 'terminado', 'sin novedad', 'todo bien']
};

// ===== PATRONES DE DIRECCIÓN =====
const ADDRESS_PATTERNS = [
  // Patrón especial: *LUGAR* (formato operativo común en los grupos)
  /\*LUGAR\*\s*[:.]?\s*([^*\n]+)/i,
  // Patrón especial: LUGAR:, UBICACION:, DIRECCIÓN:
  /(?:LUGAR|UBICACI[OÓ]N|DIRECCI[OÓ]N)\s*[:.]\s*([^\n*]+)/i,
  // Calles con prefijo formal (Añadido Aux/Auxiliar)
  /((?:Av(?:enida)?|Jr|Jirón|Jiron|Calle|Cl|Psje|Pasaje|Pj|Alameda|Boulevard|Blvd|Aux\.?|Auxiliar)\.?\s+[A-Za-záéíóúÁÉÍÓÚñÑ\s]+(?:\s+(?:cdra?\.?\s*)?\d+[A-Za-z]?)?)/i,
  // Cuadra N de Calle
  /((?:cuadra|cdra?\.?)\s+\d+(?:\s+de)?\s+(?:Av(?:enida)?|Jr|Jirón|Jiron|Calle|Cl|Psje|Pasaje)\.?\s+[A-Za-záéíóúÁÉÍÓÚñÑ\s]+)/i,
  // Cruces e intersecciones
  /((?:cruce|esquina|esq\.?)\s+(?:de\s+)?[A-Za-záéíóúÁÉÍÓÚñÑ\s]+\s+(?:con|y)\s+[A-Za-záéíóúÁÉÍÓÚñÑ\s]+)/i,
  // Manzana / Lote
  /(Mz\.?\s*[A-Za-z0-9]+\s*(?:Lt|Lote)\.?\s*\d+(?:\s*[-,]\s*[A-Za-záéíóúÁÉÍÓÚñÑ\s]+)?)/i,
  // AAHH, Urbanización, Asociación
  /((?:AA\.?\s*HH\.?|Asentamiento\s+Humano|Urb(?:anización)?\.?|Asoc(?:iación)?\.?)\s+[A-Za-záéíóúÁÉÍÓÚñÑ\s]+)/i,
  // Sector
  /(Sector\s+\d+(?:\s*[-,]\s*[A-Za-záéíóúÁÉÍÓÚñÑ\s]+)?)/i,
  // Patrón flexible: "calle/nombre + número" (ej: "julio c tello 873", "bulevar marco capac 38")
  /(?:predio|en el|en la|por|frente a)\s+([A-Za-záéíóúÁÉÍÓÚñÑ\s]{4,}\s+\d{1,5})/i,
  // Patrón Natural (NUEVO): Captura nombres propios después de conectores (ej: "en Auxiliar Faucett", "frente a Plaza San Miguel")
  /(?:en|en el|en la|en el punto de|por|frente a|altura|esquina|cerca de|ubicado en)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/,
  // Capturar lo que sigue a "en " si son al menos 2 palabras capitalizadas
  /\ben\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/,
];

// ===== DETECCIÓN DE SECTOR =====
const SECTOR_PATTERNS = [
  { pattern: /[Ss]ector\s*(\d+)/i, extract: (m) => `Sector ${m[1]}` },
  { pattern: /\bS(\d)\b/, extract: (m) => `Sector ${m[1]}` },
  { pattern: /\bS(\d)\s*[-–]\s*/i, extract: (m) => `Sector ${m[1]}` },
];

// ===================================================================
// FUNCIONES PRINCIPALES
// ===================================================================

function detectGroupFromChatName(chatName) {
  // DESACTIVADO por solicitud del usuario: ya no se guía de palabras clave en el nombre
  return null;
}

function isMonitoredGroup(chatName, remoteId = null) {
  // 1. MODO ESTRICTO: Solo lo que esté en la cache de vinculados (DB)
  if (remoteId && CACHE_GRUPOS_VINCULADOS[remoteId]) {
    const isMon = CACHE_GRUPOS_VINCULADOS[remoteId].monitored === true || CACHE_GRUPOS_VINCULADOS[remoteId].monitoreado === true;
    return isMon;
  }
  
  // Log para que sepas por qué no llega (puedes verlo en pm2 logs)
  if (remoteId) {
    console.log(`ℹ️ Mensaje ignorado: Grupo [${chatName}] no está vinculado o monitoreo está OFF.`);
  }
  
  return false;
}

function classifyMessage(text, chatName = '', remoteId = null) {
  const lowerText = text.toLowerCase();

  // Áreas detectadas por el contenido (keywords)
  const areasPorContenido = new Set();

  // Áreas detectadas por vinculación DIRECTA (DB) u ORIGEN (Keywords en nombre)
  let areaPorVinculo = null;

  // Prioridad: Vinculación Manual en Base de Datos
  if (remoteId && CACHE_GRUPOS_VINCULADOS[remoteId]) {
    const link = CACHE_GRUPOS_VINCULADOS[remoteId];
    if (link.monitoreado) {
      // Normalizar: Convertir "Seg. Ciudadana" a "seguridad" si es necesario
      const rawAreaId = link.areaId;
      if (rawAreaId === 'Seg. Ciudadana' || rawAreaId === 'Seguridad') areaPorVinculo = 'seguridad';
      else if (rawAreaId === 'Ambiental' || rawAreaId === 'Des. Ambiental') areaPorVinculo = 'ambiental';
      else if (rawAreaId === 'Urbano') areaPorVinculo = 'urbano';
      else if (rawAreaId === 'Humano') areaPorVinculo = 'humano';
      else areaPorVinculo = rawAreaId;
    }
  }

  let categoriaDetectada = 'Sin clasificar';
  let prioridadBase = 'Media';
  const categoriasMultiples = [];

  // 1. Analizar el mensaje contra el diccionario (Solo para Categoría y Prioridad)
  for (const incidencia of INCIDENCIAS) {
    if (incidencia.keywords.some(k => lowerText.includes(k))) {
      categoriasMultiples.push({
        categoria: incidencia.categoria,
        prioridad: incidencia.prioridad
      });
    }
  }

  // 2. LÓGICA DE DERIVACIÓN FINAL (100% ESTRICTA):
  // REGLA DE ORO: El grupo manda sobre el contenido.
  let areasFinales = new Set();

  if (areaPorVinculo) {
    // El área viene EXCLUSIVAMENTE de la base de datos
    areasFinales.add(areaPorVinculo);
  } else {
    // Fallback: Si no hay vínculo, va a 'otros'
    areasFinales.add('otros');
  }

  // 3. Determinar categoría principal
  if (categoriasMultiples.length > 0) {
    const prioridadOrder = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
    categoriasMultiples.sort((a, b) => (prioridadOrder[b.prioridad] || 0) - (prioridadOrder[a.prioridad] || 0));

    categoriaDetectada = categoriasMultiples[0].categoria;
    prioridadBase = categoriasMultiples[0].prioridad;
  }

  // 4. Override de prioridad por keywords urgentes
  if (PRIORIDAD_OVERRIDE.Alta.some(k => lowerText.includes(k))) {
    prioridadBase = 'Alta';
  } else if (prioridadBase !== 'Alta' && PRIORIDAD_OVERRIDE.Baja.some(k => lowerText.includes(k))) {
    prioridadBase = 'Baja';
  }

  return {
    areaPrincipal: [...areasFinales][0],
    areasDerivadas: [...areasFinales],
    categoria: categoriaDetectada,
    prioridad: prioridadBase,
    categoriasDetectadas: categoriasMultiples.map(c => c.categoria),
    esDerivacionMultiple: areasFinales.size > 1
  };
}

/**
 * Extrae la dirección más probable del texto del mensaje
 */
function extractAddress(text) {
  for (const pattern of ADDRESS_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().replace(/\s+/g, ' ');
    }
  }
  return null;
}

/**
 * Detecta el sector del mensaje
 */
function detectSector(text) {
  for (const sp of SECTOR_PATTERNS) {
    const match = text.match(sp.pattern);
    if (match) return sp.extract(match);
  }
  return 'Sin sector';
}

/**
 * Análisis completo de un mensaje
 */
function analyzeMessage(text, chatName = '', remoteId = null) {
  const classification = classifyMessage(text, chatName, remoteId);
  const address = extractAddress(text);
  const sector = detectSector(text);

  return {
    ...classification,
    direccionExtraida: address,
    sector: sector,
  };
}

module.exports = {
  GRUPOS_CONFIG,
  INCIDENCIAS,
  detectGroupFromChatName,
  isMonitoredGroup,
  classifyMessage,
  extractAddress,
  detectSector,
  analyzeMessage,
  syncGruposVinculados
};
