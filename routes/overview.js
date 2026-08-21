const express = require('express');
const { Op } = require('sequelize');
const { buildGerenciaWhere } = require('../utils/gerencia-rbac');
const router = express.Router();

// GET /api/overview
router.get('/', async (req, res) => {
  const MensajeWhatsapp = req.models?.MensajeWhatsapp || null;

  const ZERO = { kpis: { incidenciasHoy: { valor: 0, ayer: 0, variacion: '0%' }, licenciasActivas: { valor: 0, porVencer: 0, variacion: '0' }, beneficiariosAbr: { valor: 0, campanas: 0, variacion: '0%' }, alertasActivas: { valor: 0, criticas: 0, variacion: '0' } }, semaforo: [], alertas: [], gerencias: [] };
  if (!MensajeWhatsapp) {
    return res.json(ZERO);
  }

  try {
    const { fn, col, literal } = require('sequelize');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    const [totalHoy, totalAyer, totalNuevos] = await Promise.all([
      MensajeWhatsapp.count({ where: { fecha: { [Op.gte]: hoy } } }),
      MensajeWhatsapp.count({ where: { fecha: { [Op.gte]: ayer, [Op.lt]: hoy } } }),
      MensajeWhatsapp.count({ where: { estado: 'nuevo' } }),
    ]);

    const variacionPct = totalAyer > 0
      ? `${totalHoy >= totalAyer ? '+' : ''}${Math.round((totalHoy - totalAyer) / totalAyer * 100)}%`
      : (totalHoy > 0 ? '+100%' : '0%');

    const kpisReales = {
      incidenciasHoy:    { valor: totalHoy,    ayer: totalAyer,   variacion: variacionPct },
      licenciasActivas:  { valor: 0,            porVencer: 0,      variacion: '0' },
      beneficiariosAbr:  { valor: 0,            campanas: 0,       variacion: '0%' },
      alertasActivas:    { valor: totalNuevos,  criticas: 0,       variacion: `${totalNuevos}` },
    };

    // Semáforo por sector desde BD
    const porSector = await MensajeWhatsapp.findAll({
      attributes: ['sector', [fn('COUNT', col('idString')), 'total']],
      where: { sector: { [Op.not]: null }, estado: { [Op.in]: ['nuevo', 'en_proceso'] } },
      group: ['sector'],
      order: [[literal('total'), 'DESC']],
      limit: 6,
      raw: true
    });

    const semaforoReal = porSector.map(s => {
      const n = parseInt(s.total);
      return {
        sector: s.sector || 'Sin sector',
        nivel: n >= 10 ? 'Alto' : n >= 5 ? 'Medio' : 'Bajo',
        color: n >= 10 ? 'red' : n >= 5 ? 'amber' : 'green',
        incidencias: n
      };
    });

    res.json({
      kpis: kpisReales,
      semaforo: semaforoReal,
      alertas: [],
      gerencias: []
    });
  } catch (err) {
    console.error('Error en overview real:', err.message);
    res.json(ZERO);
  }
});

// GET /api/overview/notificaciones
router.get('/notificaciones', async (req, res) => {
  try {
    const whereOpts = {
      estado: {
        [Op.in]: ['nuevo', 'en_proceso', 'en proceso']
      }
    };

    const gerenciaFilter = await buildGerenciaWhere(req, Op);
    if (gerenciaFilter) Object.assign(whereOpts, gerenciaFilter);

    const MensajeWhatsapp = req.models?.MensajeWhatsapp || null;
    const pendingReportes = await MensajeWhatsapp.findAll({
      where: whereOpts,
      order: [['fecha', 'DESC']],
      limit: 10
    });

    const notificaciones = pendingReportes.map(r => {
      const diffMs = new Date() - new Date(r.fecha);
      const diffMins = Math.floor(diffMs / 60000);
      let timeStr = 'Hace un momento';
      if (diffMins >= 60) {
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs >= 24) {
          timeStr = `Hace ${Math.floor(diffHrs / 24)}d`;
        } else {
          timeStr = `Hace ${diffHrs}h`;
        }
      } else if (diffMins > 0) {
        timeStr = `Hace ${diffMins} min`;
      }

      const color = (r.estado === 'nuevo') ? 'var(--red)' : 'var(--amber)';
      const prefix = (r.estado === 'nuevo') ? '🔴' : '🟡';
      const labelEstado = (r.estado === 'nuevo') ? 'Pendiente' : 'En Proceso';

      return {
        id: r.idString || String(r.id),
        leida: false,
        title: `${prefix} ${r.idString || 'Incidencia'} - ${labelEstado}`,
        body: `${r.categoria || 'General'}: ${(r.mensaje || '').substring(0, 60)}...`,
        time: timeStr,
        color: color,
        grupo: r.grupo
      };
    });

    res.json({ notificaciones, count: notificaciones.length });
  } catch (err) {
    console.error('Error fetching real notifications:', err.message);
    res.json({ notificaciones: [], count: 0 });
  }
});

module.exports = router;
