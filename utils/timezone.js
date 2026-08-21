// Timezone helper functions
module.exports = {
  getSystemTimezone,
  getUtcDateRange,
  getStartOfDayInTimezone
};

const { Configuracion } = require('../database/models');

let _tzCache = null;
let _tzCacheAt = 0;
const TZ_TTL = 5 * 60 * 1000; // 5 minutos

async function getSystemTimezone() {
  const now = Date.now();
  if (_tzCache && (now - _tzCacheAt) < TZ_TTL) return _tzCache;
  try {
    const config = await Configuracion.findOne({ where: { clave: 'system_timezone' } });
    _tzCache = config ? config.valor : 'America/Lima';
    _tzCacheAt = now;
    return _tzCache;
  } catch (e) {
    return 'America/Lima';
  }
}

function getUtcDateRange(from, to, timeZone = 'America/Lima') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
    
    const getOffset = (date) => {
      const parts = formatter.formatToParts(date);
      const partVal = (type) => parts.find(p => p.type === type).value;
      const tzString = `${partVal('year')}-${partVal('month')}-${partVal('day')}T${partVal('hour')}:${partVal('minute')}:${partVal('second')}Z`;
      const tzDate = new Date(tzString);
      return (tzDate.getTime() - date.getTime());
    };
    
    const fromLocal = new Date(`${from}T00:00:00Z`);
    const offsetFrom = getOffset(fromLocal);
    const startUtc = new Date(fromLocal.getTime() - offsetFrom);
    
    const toLocal = new Date(`${to}T23:59:59Z`);
    const offsetTo = getOffset(toLocal);
    const endUtc = new Date(toLocal.getTime() - offsetTo);
    
    return { startUtc, endUtc };
  } catch (e) {
    return {
      startUtc: new Date(`${from} 00:00:00`),
      endUtc: new Date(`${to} 23:59:59`)
    };
  }
}

async function getStartOfDayInTimezone(timeZone = 'America/Lima') {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    const { startUtc } = getUtcDateRange(`${y}-${m}-${d}`, `${y}-${m}-${d}`, timeZone);
    return startUtc;
  } catch (e) {
    const fallback = new Date();
    fallback.setHours(0,0,0,0);
    return fallback;
  }
}
