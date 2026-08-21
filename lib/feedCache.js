// Caché en memoria para el feed en vivo (tenant-scoped).
// Las claves tienen el formato "${orgId}:${grupo}" para evitar cruce de datos entre municipios.
// Se resetea al reiniciar el servidor; la fuente de verdad permanente es la BD.
const feeds = {};    // { ["orgId:grupo"]: [...últimos 50 mensajes] }
const reportes = []; // fallback cuando no hay BD disponible

function pushToFeed(key, mensaje) {
  if (!feeds[key]) feeds[key] = [];
  feeds[key].unshift(mensaje);
  if (feeds[key].length > 50) feeds[key].pop();
}

function filterFeed(key, predicate) {
  if (feeds[key]) feeds[key] = feeds[key].filter(predicate);
}

// Helper: construye la clave compuesta orgId:grupo
function feedKey(orgId, grupo) {
  return `${orgId || 'default'}:${grupo}`;
}

module.exports = { feeds, reportes, pushToFeed, filterFeed, feedKey };
