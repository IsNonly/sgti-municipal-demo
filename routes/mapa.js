// ===== SGTI Municipal — Mapa API Routes =====
const express = require('express');
const { buildGerenciaWhere } = require('../utils/gerencia-rbac');
const MAPA_LAYERS = {
  incidencias: { color: '#f87171', label: 'Incidencias' },
  negocios:    { color: '#fbbf24', label: 'Negocios' },
  obras:       { color: '#fb923c', label: 'Obras' },
  riesgo:      { color: '#f87171', label: 'Riesgo' },
  semaforo:    { color: '#34d399', label: 'Semáforo' },
};
const router = express.Router();

// Helper: obtener modelo BD
function getModel(req) {
  return req?.models?.MensajeWhatsapp || null;
}
function isDbConnected(req) {
  return !!(req?.models?.MensajeWhatsapp);
}

// GET /api/mapa/layers — Capas estáticas del mapa (Limpio de datos falsos)
router.get('/layers', (req, res) => {
  const out = {};
  for (const key in MAPA_LAYERS) out[key] = { ...MAPA_LAYERS[key], points: [] };
  res.json(out);
});

const { getSystemTimezone, getUtcDateRange } = require('../utils/timezone');

// GET /api/mapa/reportes — Reportes geocodificados para el mapa
router.get('/reportes', async (req, res) => {
  const Model = getModel(req);
  const { from, to } = req.query;

  // Colores por estado y prioridad
  const estadoColors = { nuevo: '#f87171', en_proceso: '#fbbf24', atendido: '#34d399' };
  const prioridadRadius = { Alta: 10, Media: 7, Baja: 5 };

  // Intentar leer de BD
  if (Model && isDbConnected(req)) {
    try {
      const { Op } = require('sequelize');
      const whereOpts = { lat: { [Op.not]: null } };

      if (from && to) {
        const tz = await getSystemTimezone();
        const { startUtc, endUtc } = getUtcDateRange(from, to, tz);
        whereOpts.fecha = { [Op.between]: [startUtc, endUtc] };
      }
      
      // Filtro RBAC dinámico por sub-áreas de la gerencia del usuario
      const gerenciaFilter = await buildGerenciaWhere(req, Op);
      if (gerenciaFilter) Object.assign(whereOpts, gerenciaFilter);

      const mensajes = await Model.findAll({
        where: whereOpts,
        order: [['fecha', 'DESC']],
        limit: 1000,
      });

      const { resolveSector } = require('../utils/sector-resolver');
      const tenantSubdominio = req.tenantInfo?.subdominio || null;
      const points = mensajes.map(m => {
        let sectorFinal = m.sector;
        if (m.lat && m.lng && (!sectorFinal || sectorFinal.toLowerCase() === 'sector central' || sectorFinal === '')) {
          const resuelto = resolveSector(m.lat, m.lng, 'default', tenantSubdominio);
          if (resuelto) {
            sectorFinal = resuelto;
            m.sector = resuelto;
            m.save().catch(err => console.error('Error auto-corrigiendo sector en mapa:', err.message));
          }
        }
        if (!sectorFinal || sectorFinal.toLowerCase() === 'sector central') {
          sectorFinal = 'Fuera de Jurisdicción';
        }
        const areas = m.areasDerivadas ? JSON.parse(m.areasDerivadas) : [m.grupo];
        return {
          lat: parseFloat(m.lat),
          lng: parseFloat(m.lng),
          popup: `<b>${m.idString} ${getEstadoIcon(m.estado)}</b><br>${(m.mensaje || '').substring(0, 50)}...<br><small>${m.categoria} | ${m.ubicacion || ''}</small>${areas.length > 1 ? `<br><em>Derivado a: ${areas.join(', ')}</em>` : ''}`,
          color: estadoColors[m.estado] || '#f87171',
          radius: prioridadRadius[m.prioridad] || 7,
          id: m.idString,
          estado: m.estado,
          prioridad: m.prioridad,
          grupo: m.grupo,
          areasDerivadas: areas,
          sector: sectorFinal || 'Fuera de Jurisdicción',
          categoria: m.categoria || '',
          mensaje: m.mensaje || '',
          fecha: m.fecha,
          fotoUrl: m.fotoUrl || '',
          ubicacion: m.ubicacion || '',
        };
      });

      return res.json({ points, total: points.length, source: 'database' });
    } catch (err) {
      console.error('Error leyendo reportes para mapa:', err.message);
    }
  }

  // Sin bot activo: sin datos en memoria
  let allReportes = [];

  if (from && to) {
    const dFrom = new Date(from);
    const dTo = new Date(to + 'T23:59:59');
    allReportes = allReportes.filter(r => {
      const d = new Date(r.fecha);
      return d >= dFrom && d <= dTo;
    });
  }
  
  if (req.user && req.user.gerencia !== 'all' && req.user.gerencia !== 'municipal') {
    const { getAreasPermitidas } = require('../utils/gerencia-rbac');
    const Gerencia = req.models?.Gerencia;
    const areas = await getAreasPermitidas(Gerencia, req.user.gerencia);
    allReportes = allReportes.filter(r =>
      areas.includes(r.grupo) ||
      (r.areasDerivadas && areas.some(a => r.areasDerivadas.includes(a)))
    );
  }

  const { resolveSector } = require('../utils/sector-resolver');
  const tenantSubdominioFallback = req.tenantInfo?.subdominio || null;
  const points = allReportes.filter(m => m.lat && m.lng).map(m => {
    let sectorFinal = m.sector;
    if (!sectorFinal || sectorFinal.toLowerCase() === 'sector central' || sectorFinal === '') {
      const resuelto = resolveSector(m.lat, m.lng, 'default', tenantSubdominioFallback);
      if (resuelto) {
         sectorFinal = resuelto;
         m.sector = resuelto; // update in memory reference
      }
    }
    if (!sectorFinal || sectorFinal.toLowerCase() === 'sector central') {
      sectorFinal = 'Fuera de Jurisdicción';
    }
    const areas = m.areasDerivadas || [m.grupo];
    
    // Tamaños por prioridad:
    const radiusMap = { Alta: 10, Media: 7, Baja: 5 };
    const finalRadius = radiusMap[m.prioridad] || 7;
    return {
      lat: parseFloat(m.lat),
      lng: parseFloat(m.lng),
      popup: `<b>${m.id} ${getEstadoIcon(m.estado)}</b><br>${(m.mensaje || '').substring(0, 50)}...<br><small>${m.categoria || ''} | ${m.ubicacion || ''}</small>${areas.length > 1 ? `<br><em>Derivado a: ${areas.join(', ')}</em>` : ''}`,
      color: estadoColors[m.estado] || '#34d399', 
      radius: finalRadius,
      id: m.id,
      estado: m.estado,
      prioridad: m.prioridad,
      grupo: m.grupo,
      areasDerivadas: areas,
      sector: sectorFinal || 'Fuera de Jurisdicción',
      categoria: m.categoria || '',
      mensaje: m.mensaje || '',
      fecha: m.fecha,
      fotoUrl: m.fotoUrl || '',
      ubicacion: m.ubicacion || '',
    };
  });

  res.json({ points, total: points.length, source: 'memory' });
});

function getEstadoIcon(estado) {
  const icons = { nuevo: '🔴', en_proceso: '🟡', atendido: '🟢' };
  return icons[estado] || '🔴';
}

module.exports = router;
