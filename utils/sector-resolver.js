const fs = require('fs');
const path = require('path');

let cacheSectoresMap = {};

function pointInPolygon(point, polygon) {
  const x = point[0]; // longitude
  const y = point[1]; // latitude
  let inside = false;
  
  const outerRing = polygon[0];
  if (!outerRing) return false;
  
  for (let i = 0, j = outerRing.length - 1; i < outerRing.length; j = i++) {
    const xi = outerRing[i][0], yi = outerRing[i][1];
    const xj = outerRing[j][0], yj = outerRing[j][1];
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  if (inside) {
    for (let k = 1; k < polygon.length; k++) {
      const hole = polygon[k];
      let insideHole = false;
      for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
        const xi = hole[i][0], yi = hole[i][1];
        const xj = hole[j][0], yj = hole[j][1];
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) insideHole = !insideHole;
      }
      if (insideHole) {
        return false;
      }
    }
  }
  
  return inside;
}

function pointInMultiPolygon(point, multipolygon) {
  for (let i = 0; i < multipolygon.length; i++) {
    if (pointInPolygon(point, multipolygon[i])) {
      return true;
    }
  }
  return false;
}

function resolveSector(lat, lng, grupo = 'default', tenantSubdominio = null) {
  if (lat === undefined || lng === undefined || lat === null || lng === null) return null;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) return null;

  try {
    const cacheKey = `${tenantSubdominio || 'global'}__${grupo || 'default'}`;
    if (!cacheSectoresMap[cacheKey]) {
      // Buscar primero en carpeta del tenant, luego en la carpeta global
      const baseDir = path.join(__dirname, '../public/data');
      const tenantDir = tenantSubdominio
        ? path.join(baseDir, 'tenants', tenantSubdominio)
        : null;

      let geojsonPath = null;
      if (tenantDir) {
        const byGrupo = path.join(tenantDir, `Sectores_${grupo}.geojson`);
        const byDefault = path.join(tenantDir, 'Sectores.geojson');
        if (fs.existsSync(byGrupo)) geojsonPath = byGrupo;
        else if (fs.existsSync(byDefault)) geojsonPath = byDefault;
      }
      // Sin fallback global: cada tenant tiene sus propios sectores o ninguno

      if (geojsonPath) {
        const raw = fs.readFileSync(geojsonPath, 'utf8');
        cacheSectoresMap[cacheKey] = JSON.parse(raw);
      } else {
        cacheSectoresMap[cacheKey] = null;
      }
    }

    const geojson = cacheSectoresMap[cacheKey];
    if (geojson && geojson.features) {
      for (const feature of geojson.features) {
        const name = feature.properties.Name;
        const geom = feature.geometry;
        if (geom.type === 'Polygon') {
          if (pointInPolygon([longitude, latitude], geom.coordinates)) {
            return name;
          }
        } else if (geom.type === 'MultiPolygon') {
          if (pointInMultiPolygon([longitude, latitude], geom.coordinates)) {
            return name;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error al resolver sector geográficamente:', err.message);
  }

  // Fallback a grupo default si falló con un grupo específico
  if (grupo && grupo !== 'default') {
    return resolveSector(lat, lng, 'default', tenantSubdominio);
  }

  return 'Fuera de Jurisdicción';
}

function clearCache() {
  cacheSectoresMap = {};
  console.log('🗺️ [SectorResolver] Caché de sectores limpiado.');
}

module.exports = {
  resolveSector,
  clearCache
};
