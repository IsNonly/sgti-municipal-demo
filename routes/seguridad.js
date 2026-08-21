const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();

function getModel(req) {
  return req?.models?.MensajeWhatsapp || null;
}

// GET /api/seguridad/serenazgo
router.get('/serenazgo', async (req, res) => {
  const Model = getModel(req);
  const ZERO_SEG = { kpis: { incidenciasHoy: { valor: 0, pendientes: 0, atendidas: 0 }, tiempoRespuesta: { valor: '0:00', unidad: 'h:min promedio' }, patrullas: { activas: 0, total: 0 }, zonaCaliente: { sector: '—', incidencias: 0 } }, heatmap: { sectors: [], data: [] }, chartIncidencias: { labels: [], data: [] } };
  if (!Model) return res.json(ZERO_SEG);

  try {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const gruposSeguridad = ['seguridad', 'serenazgo', 'Seguridad', 'Seguridad Ciudadana', 'Seg. Ciudadana'];

    const [hoyTotal, pendientes, atendidas, porSector] = await Promise.all([
      Model.count({ where: { grupo: { [Op.in]: gruposSeguridad }, fecha: { [Op.gte]: hoy } } }),
      Model.count({ where: { grupo: { [Op.in]: gruposSeguridad }, estado: 'nuevo' } }),
      Model.count({ where: { grupo: { [Op.in]: gruposSeguridad }, estado: { [Op.in]: ['atendido', 'cerrado', 'atendida', 'cerrada'] } } }),
      Model.findAll({
        attributes: ['sector', [require('sequelize').fn('COUNT', require('sequelize').col('idString')), 'total']],
        where: { grupo: { [Op.in]: gruposSeguridad }, sector: { [Op.not]: null } },
        group: ['sector'],
        order: [[require('sequelize').literal('total'), 'DESC']],
        limit: 6,
        raw: true
      })
    ]);

    // Tiempo promedio de atención (createdAt → updatedAt en registros atendidos)
    let tiempoRespuesta = '0:00';
    const atendidosRec = await Model.findAll({
      attributes: ['createdAt', 'updatedAt'],
      where: { grupo: { [Op.in]: gruposSeguridad }, estado: { [Op.in]: ['atendido', 'atendida'] } },
      raw: true,
      limit: 200
    });
    if (atendidosRec.length > 0) {
      const diffs = atendidosRec
        .map(r => (new Date(r.updatedAt) - new Date(r.createdAt)) / 60000)
        .filter(d => d > 0 && d < 1440);
      if (diffs.length > 0) {
        const avgMin = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
        tiempoRespuesta = `${Math.floor(avgMin / 60)}:${String(avgMin % 60).padStart(2, '0')}`;
      }
    }

    const zonaCaliente = porSector[0]
      ? { sector: porSector[0].sector, incidencias: parseInt(porSector[0].total) }
      : { sector: '—', incidencias: 0 };

    const sectors = porSector.map(s => s.sector);
    const chartData = porSector.map(s => parseInt(s.total));

    return res.json({
      kpis: {
        incidenciasHoy: { valor: hoyTotal, pendientes, atendidas },
        tiempoRespuesta: { valor: tiempoRespuesta, unidad: 'h:min promedio' },
        patrullas: { activas: 0, total: 0 },
        zonaCaliente
      },
      heatmap: { sectors, data: [] },
      chartIncidencias: { labels: sectors, data: chartData }
    });
  } catch (err) {
    console.error('Error en seguridad/serenazgo:', err.message);
    return res.json(ZERO_SEG);
  }
});

// GET /api/seguridad/novedades-criticas — Incidencias de seguridad ponderadas por tipo para mapa de calor
router.get('/novedades-criticas', async (req, res) => {
  const Model = getModel(req);
  if (!Model) return res.json({ points: [] });

  // Pesos por palabra clave en categoría (case-insensitive)
  const PESOS_CATEGORIA = [
    { palabras: ['homicidio','asesinato','feminicidio','muerte violenta'], peso: 10 },
    { palabras: ['violacion','violación','abuso sexual','agresion sexual'], peso: 10 },
    { palabras: ['secuestro','toma de rehen'], peso: 9 },
    { palabras: ['asalto','robo con arma','robo a mano armada','arma de fuego','disparo'], peso: 9 },
    { palabras: ['robo','hurto','sustraccion','carterista'], peso: 7 },
    { palabras: ['agresion','agresión','violencia familiar','lesiones','pelea'], peso: 7 },
    { palabras: ['incendio','explosion','emergencia'], peso: 6 },
    { palabras: ['accidente','atropello','choque'], peso: 5 },
    { palabras: ['persona sospechosa','merodeo','pandilla'], peso: 5 },
    { palabras: ['escandalo','ruido','disturbio'], peso: 3 },
  ];

  function calcularPeso(categoria, prioridad, mensaje) {
    const texto = [(categoria || ''), (mensaje || '')].join(' ').toLowerCase();
    for (const { palabras, peso } of PESOS_CATEGORIA) {
      if (palabras.some(p => texto.includes(p))) return peso;
    }
    // Fallback por prioridad
    if (prioridad === 'Alta' || prioridad === 'alta') return 6;
    if (prioridad === 'Baja' || prioridad === 'baja') return 2;
    return 4;
  }

  try {
    const gruposSeguridad = ['seguridad','serenazgo','Seguridad','Seguridad Ciudadana','Seg. Ciudadana'];
    const mensajes = await Model.findAll({
      where: {
        grupo: { [Op.in]: gruposSeguridad },
        lat:   { [Op.not]: null },
        lng:   { [Op.not]: null },
      },
      order: [['fecha', 'DESC']],
      limit: 800,
    });

    function etiquetaCategoria(categoria, prioridad, mensaje) {
      const texto = [(categoria || ''), (mensaje || '')].join(' ').toLowerCase();
      for (const { palabras, peso } of PESOS_CATEGORIA) {
        const match = palabras.find(p => texto.includes(p));
        if (match) return match.charAt(0).toUpperCase() + match.slice(1);
      }
      return categoria || 'Seguridad';
    }

    const points = mensajes.map(m => {
      const peso = calcularPeso(m.categoria, m.prioridad, m.mensaje);
      return {
        lat:       parseFloat(m.lat),
        lng:       parseFloat(m.lng),
        peso,
        pesoNorm:  peso / 10,           // 0-1 para leaflet-heat
        categoria: etiquetaCategoria(m.categoria, m.prioridad, m.mensaje),
        novedad:   (m.mensaje || '').substring(0, 120),
        sector:    m.sector || 'Sin sector',
        prioridad: m.prioridad || 'Media',
        estado:    m.estado || 'nuevo',
        fecha:     m.fecha,
        id:        m.idString,
        ubicacion: m.ubicacion || '',
      };
    });

    // Ordenar: más crítico primero
    points.sort((a, b) => b.peso - a.peso);

    res.json({ points, total: points.length });
  } catch (err) {
    console.error('Error en novedades-criticas:', err.message);
    res.json({ points: [] });
  }
});

// GET /api/seguridad/fiscalizacion
router.get('/fiscalizacion', async (req, res) => {
  const Model = getModel(req);
  const ZERO_FISC = { kpis: { operativos: { valor: 0, estaSemana: 0 }, clausuras: { valor: 0, reincidencia: 0 }, multas: { valor: 0, monto: 'S/ 0' }, cumplimiento: { valor: '0%', label: 'en regla' } }, operativos: [] };
  if (!Model) return res.json(ZERO_FISC);

  try {
    const gruposFisc = ['fiscalizacion_transporte', 'fiscalizacion', 'transporte', 'Fiscalización', 'fiscalización'];

    const [totalOps, pendientes] = await Promise.all([
      Model.count({ where: { grupo: { [Op.in]: gruposFisc } } }),
      Model.count({ where: { grupo: { [Op.in]: gruposFisc }, estado: 'nuevo' } }),
    ]);

    return res.json({
      kpis: {
        operativos: { valor: totalOps, estaSemana: 0 },
        clausuras: { valor: 0, reincidencia: 0 },
        multas: { valor: 0, monto: 'S/ 0' },
        cumplimiento: { valor: '0%', label: 'en regla' },
      },
      operativos: []
    });
  } catch (err) {
    console.error('Error en seguridad/fiscalizacion:', err.message);
    return res.json(ZERO_FISC);
  }
});

module.exports = router;
