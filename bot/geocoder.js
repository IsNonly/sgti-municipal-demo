// ===== SGTI Municipal — Geocodificador de Direcciones =====
// Convierte direcciones de texto a coordenadas lat/lng usando Nominatim (OSM)
// Gratis, sin API key. Limitado a Carmen de La Legua Reynoso, Callao, Perú.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Coordenadas centrales del distrito Carmen de La Legua Reynoso
const DISTRITO_CENTER = { lat: -12.0435, lng: -77.0955 };

// Bounding box del distrito (Ajustado a los 17 sectores oficiales - ampliado ligeramente)
const DISTRITO_BBOX = {
  south: -12.0490, // Límite Av. Argentina / Chalaca (ampliado)
  north: -12.0350, // Límite Río Rímac (ampliado)
  west: -77.1020,  // Límite Gambetta (ampliado)
  east: -77.0790   // Límite Lima (ampliado)
};

// Cache en memoria para evitar peticiones repetidas
const geocodeCache = new Map();

// Rate limiter: Nominatim requiere max 1 req/segundo
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 segundos entre requests

/**
 * Espera para respetar el rate limit de Nominatim
 */
async function rateLimitWait() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Normaliza una dirección para mejorar la búsqueda
 * Remueve ruido común en los mensajes de WhatsApp y mejora intersecciones
 */
function normalizeAddress(address) {
  if (!address) return '';
  
  let clean = address
    // Remover nombres de personal o cargos que ensucian la dirección
    .replace(/(insp|inspector|gerente|supervisor|sereno|unidad|móvil|movil|tgo|personal|encargado)\.?\s+[A-Za-zÀ-ÿ]+\s*[A-Za-zÀ-ÿ]*/gi, '')
    // Remover frases de introducción comunes
    .replace(/^(atención médica domiciliaria|reporte de|incidente en|emergencia en|ubicación:|dirección:)\s*/gi, '')
    // Remover marcadores de formato WhatsApp
    .replace(/\*/g, '')
    // Manejar intersecciones "con" -> "y" (Nominatim prefiere "and" o "y")
    .replace(/\bcon\b/gi, ' y ')
    // Abreviaturas de calles
    .replace(/\bcdr?a?\.?\s*/gi, 'cuadra ')
    .replace(/\bAv\.?\s*/gi, 'Avenida ')
    .replace(/\bJr\.?\s*/gi, 'Jirón ')
    .replace(/\bCl\.?\s*/gi, 'Calle ')
    .replace(/\bPsje\.?\s*/gi, 'Pasaje ')
    .replace(/\bAux\.?\s*/gi, 'Avenida Auxiliar ')
    .replace(/\bAuxiliar\b/gi, 'Avenida Auxiliar ')
    .replace(/\besq\.?\s*/gi, 'esquina ')
    // Limpieza general
    .replace(/\s+/g, ' ')
    .trim();

  return clean;
}

/**
 * Geocodifica una dirección y retorna coordenadas { lat, lng }
 * Añade "Carmen de La Legua Reynoso, Callao, Perú" para mejorar precisión
 */
async function geocodeAddress(address) {
  if (!address || address === 'Por determinar') return null;

  const normalizedAddr = normalizeAddress(address);
  if (!normalizedAddr || normalizedAddr.length < 3) return null;

  // Check cache
  const cacheKey = normalizedAddr.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    await rateLimitWait();

    // Priorizar búsqueda local — Forzamos Carmen de la Legua como parte de la cadena principal
    const searchQuery = `${normalizedAddr}, Carmen de La Legua Reynoso, Callao, Perú`;

    const params = new URLSearchParams({
      q: searchQuery,
      format: 'json',
      limit: '5',
      addressdetails: '1',
      viewbox: `${DISTRITO_BBOX.west},${DISTRITO_BBOX.north},${DISTRITO_BBOX.east},${DISTRITO_BBOX.south}`,
      bounded: '1', 
      'accept-language': 'es'
    });

    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        'User-Agent': 'SGTI-Municipal-CDLL/2.0 (sistema.territorial@carmendelalegua.gob.pe)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Geocoder HTTP error: ${response.status}`);
      return null;
    }

    const results = await response.json();

    if (results.length > 0) {
      // Filtrar resultados para asegurar que estén dentro del BBOX estricto
      const validResult = results.find(r => {
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);
        return lat >= DISTRITO_BBOX.south && lat <= DISTRITO_BBOX.north &&
               lon >= DISTRITO_BBOX.west && lon <= DISTRITO_BBOX.east;
      });

      if (validResult) {
        const result = {
          lat: parseFloat(validResult.lat),
          lng: parseFloat(validResult.lon),
          displayName: validResult.display_name
        };
        geocodeCache.set(cacheKey, result);
        console.log(`📍 Geocodificado (estricto): "${normalizedAddr}" → ${result.lat}, ${result.lng}`);
        return result;
      }
    }

    // SEGUNDO INTENTO: Búsqueda sin bounded estricto (para calles cercanas al límite)
    await rateLimitWait();
    const params2 = new URLSearchParams({
      q: `${normalizedAddr}, Callao, Perú`,
      format: 'json',
      limit: '3',
      addressdetails: '1',
      viewbox: `${DISTRITO_BBOX.west - 0.01},${DISTRITO_BBOX.north + 0.005},${DISTRITO_BBOX.east + 0.01},${DISTRITO_BBOX.south - 0.005}`,
      bounded: '0',
      'accept-language': 'es'
    });

    const response2 = await fetch(`${NOMINATIM_URL}?${params2}`, {
      headers: {
        'User-Agent': 'SGTI-Municipal-CDLL/2.0 (sistema.territorial@carmendelalegua.gob.pe)',
        'Accept': 'application/json'
      }
    });

    if (response2.ok) {
      const results2 = await response2.json();
      if (results2.length > 0) {
        // Aceptar resultado si está razonablemente cerca del distrito (radio ampliado)
        const nearResult = results2.find(r => {
          const lat = parseFloat(r.lat);
          const lon = parseFloat(r.lon);
          return lat >= (DISTRITO_BBOX.south - 0.008) && lat <= (DISTRITO_BBOX.north + 0.008) &&
                 lon >= (DISTRITO_BBOX.west - 0.008) && lon <= (DISTRITO_BBOX.east + 0.008);
        });

        if (nearResult) {
          const result = {
            lat: parseFloat(nearResult.lat),
            lng: parseFloat(nearResult.lon),
            displayName: nearResult.display_name
          };
          geocodeCache.set(cacheKey, result);
          console.log(`📍 Geocodificado (ampliado): "${normalizedAddr}" → ${result.lat}, ${result.lng}`);
          return result;
        }
      }
    }

    // TERCER INTENTO: Solo las primeras 2-3 palabras (Limpiar ruido excesivo)
    const simplifiedAddr = normalizedAddr.split(' ').slice(0, 3).join(' ');
    if (simplifiedAddr.length > 5 && simplifiedAddr !== normalizedAddr) {
      console.log(`🔍 Intentando búsqueda simplificada: "${simplifiedAddr}"`);
      await rateLimitWait();
      const params3 = new URLSearchParams({
        q: `${simplifiedAddr}, Carmen de La Legua, Callao, Perú`,
        format: 'json',
        limit: '1',
        'accept-language': 'es'
      });
      const response3 = await fetch(`${NOMINATIM_URL}?${params3}`, {
        headers: { 'User-Agent': 'SGTI-Municipal-CDLL/2.0', 'Accept': 'application/json' }
      });
      if (response3.ok) {
        const results3 = await response3.json();
        if (results3.length > 0) {
          const result = { lat: parseFloat(results3[0].lat), lng: parseFloat(results3[0].lon), displayName: results3[0].display_name };
          geocodeCache.set(cacheKey, result);
          return result;
        }
      }
    }

    // Si no se encuentra, retornar null
    console.log(`⚠️ No se pudo geocodificar con precisión: "${normalizedAddr}".`);
    return null;

  } catch (error) {
    console.error(`❌ Error en geocodificación de "${address}":`, error.message);
    return null;
  }
}

/**
 * Genera coordenadas dentro de una zona central del distrito como fallback
 * Mantiene los puntos dentro de los sectores visibles
 */
function generateFallbackCoords(address) {
  // Hash para que la misma dirección siempre caiga en el mismo sitio
  let hash = 0;
  const str = (address || 'default').toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }

  // Zona central segura (Sector 1, 2, 5, 6 - Corazón del distrito)
  const safeBBox = {
    south: -12.0440,
    north: -12.0410,
    west: -77.0970,
    east: -77.0930
  };

  const latRange = safeBBox.north - safeBBox.south;
  const lngRange = safeBBox.east - safeBBox.west;

  const latOffset = (Math.abs(hash) % 1000) / 1000;
  const lngOffset = (Math.abs(hash >> 8) % 1000) / 1000;

  return {
    lat: safeBBox.south + (latOffset * latRange),
    lng: safeBBox.west + (lngOffset * lngRange),
    displayName: `${address || 'Ubicación aproximada'} (Pendiente Validación), Carmen de La Legua`
  };
}


/**
 * Limpia el cache de geocodificación
 */
function clearCache() {
  geocodeCache.clear();
  console.log('🗑️ Cache de geocodificación limpiado');
}

/**
 * Convierte coordenadas { lat, lng } a una dirección legible
 */
async function reverseGeocode(lat, lng) {
  if (!lat || !lng) return null;

  // Cargar sector para fallback descriptivo
  const { resolveSector } = require('../utils/sector-resolver');
  const sectorNombre = resolveSector(lat, lng) || 'Sector Central';

  const SECTOR_NAMES = {
    "Sector 1": "Cercado / Plaza Grau",
    "Sector 2": "Villa Señor de los Milagros",
    "Sector 3": "Parque Luna y Pozo",
    "Sector 4": "Av. Morales Duárez / Manco Cápac",
    "Sector 5": "Zona Industrial Cercado",
    "Sector 6": "Límite Gambetta / Rímac",
    "Sector 7": "Urb. Reynoso Central",
    "Sector 8": "Av. Argentina / Sector Industrial",
    "Sector 9": "Urb. San Rafael",
    "Sector 10": "Sector 2 de Reynoso",
    "Sector 11": "Límite con Callao / Gambetta",
    "Sector 12": "Zona Comercial Argentina",
    "Sector 13": "Urb. Juan Ingunza",
    "Sector 14": "Sector 3 de Reynoso",
    "Sector 15": "Urb. 1ro de Mayo",
    "Sector 16": "Prolongación Av. Perú",
    "Sector 17": "Límite con Lima / Av. Universitaria"
  };

  const sectorDescriptivo = SECTOR_NAMES[sectorNombre] || sectorNombre;

  try {
    await rateLimitWait();

    const params = new URLSearchParams({
      lat: lat,
      lon: lng,
      format: 'json',
      zoom: '18',
      addressdetails: '1',
      'accept-language': 'es'
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SGTI/2.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }

    const data = await response.json();
    if (data && data.address) {
      const addr = data.address;
      let parts = [];
      if (addr.road) parts.push(addr.road);
      if (addr.house_number) parts.push(addr.house_number);
      
      if (parts.length === 0) {
        if (addr.amenity) parts.push(addr.amenity);
        else if (addr.suburb) parts.push(addr.suburb);
      }

      if (parts.length > 0) {
        const cityPart = addr.city || addr.town || addr.municipality || addr.county || '';
        let finalAddr = parts.join(' ');
        if (cityPart) finalAddr += `, ${cityPart}`;
        return finalAddr;
      }
    }

    return `Cerca de ${sectorDescriptivo}`;
  } catch (error) {
    console.error(`❌ Error en geocodificación inversa (${lat}, ${lng}):`, error.message);
    return `Cerca de ${sectorDescriptivo}`;
  }
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  generateFallbackCoords,
  clearCache,
  DISTRITO_CENTER
};

