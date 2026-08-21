// ===== SGTI Municipal — WhatsApp API Routes =====
const express = require('express');
const { Sequelize, Op } = require('sequelize');
const { feeds: whatsappFeeds, reportes: whatsappReportes, pushToFeed, filterFeed, feedKey } = require('../lib/feedCache');

// Aliases de grupos para buscar variantes históricas de nombres en la BD.
// Solo se definen grupos que tienen datos con múltiples ortografías.
// Para gerencias nuevas creadas por el admin, se usa el clave exacto.
const FISC_V = ['fiscalizacion_transporte', 'fiscalizacion', 'transporte', 'fiscalización'];
const SEG_V  = ['seguridad', 'serenazgo', 'Seg. Ciudadana', 'Seguridad Ciudadana', 'Seguridad'];
const GRUPO_ALIASES = {
  seguridad:               SEG_V,
  serenazgo:               SEG_V,
  fiscalizacion_transporte: FISC_V,
  fiscalizacion:           FISC_V,
  transporte:              FISC_V,
};
const { getSystemTimezone, getUtcDateRange } = require('../utils/timezone');
const router = express.Router();

// Helper: tiempo transcurrido
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " años";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " meses";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " días";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " horas";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " min";
  return Math.floor(seconds) + " seg";
}

// Helper: obtener modelo MensajeWhatsapp del tenant correcto (solo req.models — nunca el global)
function getModel(req) {
  return req?.models?.MensajeWhatsapp || null;
}

// Helper: check si BD está conectada para este tenant
function isDbConnected(req) {
  return !!(req?.models?.MensajeWhatsapp);
}

// ===== DASHBOARD GENERAL =====

// GET / — Panel general de WhatsApp (gerencias desde BD)
router.get('/', async (req, res) => {
  try {
    const Model = getModel(req);
    const Gerencia = req.models?.Gerencia || null;

    if (Model && isDbConnected(req)) {
      const { Sequelize } = require('sequelize');

      // Obtener gerencias activas desde la BD del tenant
      const gerencias = Gerencia
        ? await Gerencia.findAll({ where: { esSubArea: false }, order: [['orden', 'ASC']] })
        : [];

      // Contar mensajes por grupo en la BD
      const counts = await Model.findAll({
        attributes: [
          ['grupo', 'id'],
          [Sequelize.fn('COUNT', Sequelize.col('idString')), 'total']
        ],
        group: ['grupo'],
        raw: true
      });

      const gruposReales = {};
      for (const g of gerencias) {
        // Sumar registros del grupo principal + sus sub-áreas
        const clave = g.clave;
        const total = counts
          .filter(c => c.id === clave || c.id?.startsWith(clave + '_') || c.id?.includes(clave))
          .reduce((acc, c) => acc + parseInt(c.total || 0), 0);

        gruposReales[clave] = {
          nombre: g.nombre,
          icon: g.icono || '📋',
          total,
          color: g.color || 'blue',
          status: 'Activo'
        };
      }

      return res.json({ trending: [], grupos: gruposReales });
    }

    res.json({ trending: [], grupos: {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ESTADO DEL BOT =====
// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  res.json({ isAuthenticated: false, connectedGroups: [], monitoredCount: 0, totalGroups: 0, status: 'disabled' });
});

// ===== CONFIGURACIÓN =====
// GET /api/whatsapp/config — Ver configuración de clasificación
router.get('/config', (req, res) => {
  try {
    const { INCIDENCIAS } = require('../bot/classifier');
    res.json({
      incidencias: INCIDENCIAS.map(i => ({
        categoria: i.categoria,
        keywords: i.keywords,
        prioridad: i.prioridad,
        areas: i.areas
      })),
      totalCategorias: INCIDENCIAS.length,
    });
  } catch {
    res.json({ incidencias: [], totalCategorias: 0 });
  }
});

// ===== GRUPOS CONECTADOS =====
// GET /api/whatsapp/grupos-conectados
router.get('/grupos-conectados', (req, res) => {
  res.json({ isAuthenticated: false, grupos: [], monitoreados: 0, total: 0 });
});

// ===== FEED =====
// GET /api/whatsapp/feed/:grupo
router.get('/feed/:grupo', async (req, res) => {
  const grupo = req.params.grupo;

  const uGerencia = req.user ? req.user.gerencia : null;
  const uVariants = (GRUPO_ALIASES[uGerencia] || [uGerencia]);

  const isAdmin = req.user && (req.user.rol === 'admin' || req.user.gerencia === 'all');

  if (!isAdmin && req.user && !uVariants.includes(grupo)) {
    return res.status(403).json({ error: 'No tienes permiso para ver el feed de esta gerencia.' });
  }


  // Intentar leer de BD: últimos mensajes de este grupo
  const Model = getModel(req);

  try {
    if (Model) {
      const { Op } = require('sequelize');
      const securityCategories = ['Robo / Asalto', 'Comercio Informal', 'Pelea Callejera', 'Persona Sospechosa', 'Ruido Excesivo'];

      const variants = GRUPO_ALIASES[grupo] || [grupo];

      const { from, to } = req.query;
      const where = {
        [Op.or]: [
          { grupo: { [Op.in]: variants } },
          { categoria: { [Op.in]: grupo === 'seguridad' ? securityCategories : [] } },
          { areasDerivadas: { [Op.like]: `%"${grupo}"%` } },
          { areasDerivadas: { [Op.eq]: grupo } }
        ]
      };

      if (grupo === 'seguridad') {
        // Excluir solo reportes cuyo grupo principal sea fiscalizacion_transporte/transporte
        // No excluir por areasDerivadas: en algunos tenants fiscalizacion es sub-área de seguridad
        where[Op.and] = [
          { grupo: { [Op.notIn]: ['fiscalizacion_transporte', 'transporte'] } },
        ];
      }

      // Filtro por fecha (Opcional)
      if (from || to) {
        where.fecha = {};
        if (from) where.fecha[Op.gte] = `${from} 00:00:00`;
        if (to) where.fecha[Op.lte] = `${to} 23:59:59`;
      }

      const mensajes = await Model.findAll({
        where,
        order: [['fecha', 'DESC']],
        limit: 50, // Límite estricto para no saturar la UI con fotos Base64
      });

      if (mensajes && mensajes.length > 0) {
        const feed = mensajes.map(formatReporteFromDB);
        return res.json({ grupo, feed, source: 'database' });
      }
    }
  } catch (err) {
    console.error('❌ [FEED ERROR]:', err.message);
  }

  // Sin datos de BD: retornar lo que haya en caché de memoria
  const feed = whatsappFeeds[feedKey(req.organizationId, grupo)] || [];
  res.json({ grupo, feed, source: 'cache' });
});

// ===== REPORTES =====

// GET /api/whatsapp/reportes — Todos los reportes con filtros
router.get('/reportes', async (req, res) => {
  const { estado, grupo, prioridad, sector, orden, from, to } = req.query;

  const Model = getModel(req);

  // Intentar leer de BD
  if (Model) {
    try {
      const where = {};
      const { Op } = require('sequelize');


      if (estado && estado !== 'todos') where.estado = estado;
      if (grupo && grupo !== 'todos') {
        const variants = GRUPO_ALIASES[grupo] || [grupo];

        // Buscar tanto en grupo principal como en areasDerivadas usando las variantes
        where[Op.or] = [
          { grupo: { [Op.in]: variants } },
          { areasDerivadas: { [Op.like]: `%"${grupo}"%` } },
          { areasDerivadas: { [Op.eq]: grupo } }
        ];
      }
      if (prioridad && prioridad !== 'todas') where.prioridad = prioridad;
      if (sector && sector !== 'todos') where.sector = sector;

      // Filtro RBAC (Bypass para Admin o Sesión no iniciada temporalmente)
      const isAdmin = req.user && (req.user.rol === 'admin' || req.user.gerencia === 'all');
      const noUser = !req.user;

      if (!isAdmin && !noUser) {
        const uGerencia = req.user.gerencia;
        const uVariants = GRUPO_ALIASES[uGerencia] || [uGerencia];
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({
          [Op.or]: [
            { grupo: { [Op.in]: uVariants } },
            { areasDerivadas: { [Op.like]: `%"${uGerencia}"%` } },
            { areasDerivadas: { [Op.eq]: uGerencia } }
          ]
        });
        if (uGerencia === 'seguridad') {
          where[Op.and].push({
            grupo: { [Op.notIn]: ['fiscalizacion_transporte', 'transporte'] }
          });
        }
      }

      if (from && to) {
        const tz = await getSystemTimezone();
        const { startUtc, endUtc } = getUtcDateRange(from, to, tz);
        where.fecha = { [Op.between]: [startUtc, endUtc] };
      }

      const queryOptions = {
        where,
        order: [['fecha', orden === 'antiguo' ? 'ASC' : 'DESC']],
        attributes: { exclude: ['fotoUrl'] },
      };

      // Límite de resultados — solo admin/superadmin pueden usar limit=all
      const isAdminLimit = ['admin', 'superadmin'].includes(req.user?.rol);
      if (req.query.limit === 'all' && isAdminLimit) {
        // Sin límite: solo para roles con permisos de exportación completa
      } else if (req.query.limit) {
        const parsed = parseInt(req.query.limit, 10);
        queryOptions.limit = isNaN(parsed) ? 200 : Math.min(parsed, 2000);
      } else {
        queryOptions.limit = (from && to) ? 2000 : 200;
      }

      const mensajes = await Model.findAll(queryOptions);

      const reportes = mensajes.map(formatReporteFromDB);

      // Stats — queries SQL COUNT en paralelo (sin traer filas a memoria)
      const statsWhere = {};
      if (from && to) {
        statsWhere.fecha = { [Op.between]: [`${from} 00:00:00`, `${to} 23:59:59`] };
      }

      // RBAC para stats
      const isAdminStats = req.user && (req.user.rol === 'admin' || req.user.gerencia === 'all');
      if (!isAdminStats && req.user) {
        const uGerencia = req.user.gerencia;
        const uNameMap = {
          'seguridad': ['serenazgo', 'seguridad', 'Seg. Ciudadana', 'Seguridad Ciudadana', 'Seguridad'],
          'fiscalizacion_transporte': ['fiscalizacion_transporte', 'fiscalizacion', 'transporte', 'fiscalización'],
          'fiscalizacion': ['fiscalizacion_transporte', 'fiscalizacion', 'transporte', 'fiscalización'],
          'transporte': ['fiscalizacion_transporte', 'fiscalizacion', 'transporte', 'fiscalización'],
          'ambiental': ['ambiental', 'Des. Ambiental', 'Desarrollo Ambiental', 'Ambiental'],
          'urbano': ['urbano', 'Des. Urbano', 'Desarrollo Urbano', 'Urbano'],
          'humano': ['humano', 'Des. Humano', 'Desarrollo Humano', 'Humano'],
          'rentas': ['rentas', 'Rentas'],
          'municipal': ['municipal', 'Gerencia Municipal', 'Ger. Municipal']
        };
        const uVariants = uNameMap[uGerencia] || [uGerencia];
        statsWhere[Op.or] = [
          { grupo: { [Op.in]: uVariants } },
          { areasDerivadas: { [Op.like]: `%"${uGerencia}"%` } },
          { areasDerivadas: { [Op.eq]: uGerencia } }
        ];
        if (uGerencia === 'seguridad') {
          statsWhere[Op.and] = [
            { grupo: { [Op.notIn]: ['fiscalizacion_transporte', 'transporte'] } },
          ];
        }
      }

      const [statsTotal, statsNuevo, statsEnProceso, statsAtendido, statsAlta, statsPorGrupo] = await Promise.all([
        Model.count({ where: statsWhere }),
        Model.count({ where: { ...statsWhere, estado: 'nuevo' } }),
        Model.count({ where: { ...statsWhere, estado: 'en_proceso' } }),
        Model.count({ where: { ...statsWhere, estado: 'atendido' } }),
        Model.count({ where: { ...statsWhere, prioridad: 'Alta' } }),
        Model.findAll({
          where: statsWhere,
          attributes: ['grupo', [Sequelize.fn('COUNT', Sequelize.col('idString')), 'total']],
          group: ['grupo'],
          raw: true,
        }),
      ]);

      const stats = {
        total: statsTotal,
        nuevo: statsNuevo,
        en_proceso: statsEnProceso,
        atendido: statsAtendido,
        alta: statsAlta,
        porGrupo: statsPorGrupo.reduce((acc, r) => {
          acc[r.grupo || 'sin_grupo'] = parseInt(r.total || 0);
          return acc;
        }, {}),
      };

      return res.json({ reportes, stats, filtrosActivos: { estado, grupo, prioridad, sector, from, to }, source: 'database' });
    } catch (err) {
      console.error('Error leyendo reportes de BD:', err.message);
    }
  }

  res.json({ reportes: [], stats: { total: 0, nuevo: 0, en_proceso: 0, atendido: 0, alta: 0, porGrupo: {} }, filtrosActivos: { estado, grupo, prioridad, sector, from, to }, source: 'empty' });
});

// GET /api/whatsapp/reportes/:id — Detalle de un reporte
router.get('/reportes/:id', async (req, res) => {
  const Model = getModel(req);

  // BD first
  if (Model) {
    try {
      const msg = await Model.findOne({ where: { idString: req.params.id } });
      if (msg) return res.json(formatReporteFromDB(msg));
    } catch (err) {
      console.error('Error buscando reporte en BD:', err.message);
    }
  }

  return res.status(404).json({ error: 'Reporte no encontrado' });
});

// PATCH /api/whatsapp/reportes/:id — Actualizar estado
router.patch('/reportes/:id', async (req, res) => {
  const { estado, asignadoA, notas, lat, lng, ubicacion, grupo, mensaje, areasDerivadas } = req.body;
  const Model = getModel(req);

  // BD first
  if (Model) {
    try {
      const msg = await Model.findOne({ where: { idString: req.params.id } });
      if (msg) {
        if (estado) {
          msg.estado = estado;
          // Sincronizar también la memoria (feeds) para actualización inmediata sin recargar
          const orgPrefix = `${req.organizationId || 'default'}:`;
          Object.keys(whatsappFeeds).filter(k => k.startsWith(orgPrefix)).forEach(k => {
            const msgInFeed = whatsappFeeds[k].find(m => m.body.includes(req.params.id) || (m.sender === msg.reportadoPor && m.body === msg.mensaje));
            if (msgInFeed) msgInFeed.estado = estado;
          });
        }
        if (asignadoA !== undefined) msg.asignadoA = asignadoA;
        if (notas !== undefined) msg.notas = notas;
        if (lat !== undefined) msg.lat = lat;
        if (lng !== undefined) msg.lng = lng;
        if (ubicacion !== undefined) msg.ubicacion = ubicacion;
        if (grupo !== undefined) msg.grupo = grupo;
        if (mensaje !== undefined) msg.mensaje = mensaje;
        if (areasDerivadas !== undefined) {
          msg.areasDerivadas = typeof areasDerivadas === 'string' ? areasDerivadas : JSON.stringify(areasDerivadas);
        }
        await msg.save();
        return res.json({ message: 'Reporte actualizado', reporte: formatReporteFromDB(msg) });

      }
    } catch (err) {
      console.error('Error actualizando reporte en BD:', err.message);
    }
  }

  return res.status(404).json({ error: 'Reporte no encontrado' });
});

// GET /api/whatsapp/stats — Obtiene estadísticas reales para el Dashboard
router.get('/stats', async (req, res) => {
  try {
    if (!req.models) return res.status(503).json({ error: 'Tenant no resuelto' });
    const { MensajeWhatsapp, Usuario } = req.models;
    const { Sequelize, Op } = require('sequelize');
    const { getUtcDateRange, getSystemTimezone } = require('../utils/timezone');

    // Por defecto: hoy. Si vienen from/to se usa ese rango.
    const tz = await getSystemTimezone();
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
    const from = req.query.from || todayStr;
    const to   = req.query.to   || todayStr;

    const { startUtc, endUtc } = getUtcDateRange(from, to, tz);
    const dateWhere = { fecha: { [Op.between]: [startUtc, endUtc] } };

    // 1. Conteo por Gerencia filtrado por rango
    const usuarios = await Usuario.findAll({ attributes: ['nombre', 'gerencia'] });
    const userMap = {};
    usuarios.forEach(u => { userMap[u.nombre] = u.gerencia; });

    const reportes = await MensajeWhatsapp.findAll({
      where: dateWhere,
      attributes: ['grupo', 'areasDerivadas', 'reportadoPor']
    });

    const conteo = {};
    const isAdmin = req.user && req.user.rol === 'admin';
    reportes.forEach(r => {
      let area = r.grupo;
      if (area === 'fiscalizacion_transporte' && isAdmin) {
        let derivadas = [];
        try { derivadas = r.areasDerivadas ? JSON.parse(r.areasDerivadas) : []; } catch (e) {}
        if (derivadas.includes('fiscalizacion')) area = 'fiscalizacion';
        else if (derivadas.includes('transporte')) area = 'transporte';
        else area = userMap[r.reportadoPor] === 'transporte' ? 'transporte' : 'fiscalizacion';
      }
      conteo[area] = (conteo[area] || 0) + 1;
    });

    const porGerencia = Object.entries(conteo).map(([area, total]) => ({ area, total }));

    // 2. Conteo por Estado (rango seleccionado)
    const porEstado = await MensajeWhatsapp.findAll({
      where: dateWhere,
      attributes: [
        'estado',
        [Sequelize.fn('COUNT', Sequelize.col('idString')), 'total']
      ],
      group: ['estado']
    });

    // 3. Volumen diario (últimos 7 días, independiente del filtro para mostrar tendencia)
    const hace7dias = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
    const diario = await MensajeWhatsapp.findAll({
      where: { fecha: { [Op.gte]: hace7dias } },
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('fecha')), 'dia'],
        [Sequelize.fn('COUNT', Sequelize.col('idString')), 'total']
      ],
      group: [Sequelize.fn('DATE', Sequelize.col('fecha'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('fecha')), 'ASC']]
    });

    // 4. Temas Tendencia (últimas 24h, siempre contexto reciente)
    const hace24h = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
    const tendencias = await MensajeWhatsapp.findAll({
      where: { fecha: { [Op.gte]: hace24h }, categoria: { [Op.ne]: 'Sin clasificar' } },
      attributes: [
        ['categoria', 'tema'],
        [Sequelize.fn('COUNT', Sequelize.col('idString')), 'total']
      ],
      group: ['categoria'],
      order: [[Sequelize.fn('COUNT', Sequelize.col('idString')), 'DESC']],
      limit: 6
    });

    // 5. KPIs del rango seleccionado
    const total     = await MensajeWhatsapp.count({ where: dateWhere });
    const atendidos = await MensajeWhatsapp.count({ where: { ...dateWhere, estado: 'atendido' } });
    const casosCriticos = await MensajeWhatsapp.count({
      where: { ...dateWhere, prioridad: 'Alta', estado: { [Op.notIn]: ['atendido'] } }
    });

    let atencionPromedio = '0h';
    let atencionSub = 'Sin datos';
    if (atendidos > 0) {
      const avgResult = await MensajeWhatsapp.findOne({
        attributes: [[Sequelize.fn('AVG', Sequelize.literal('TIMESTAMPDIFF(MINUTE, createdAt, updatedAt)')), 'avgMin']],
        where: { ...dateWhere, estado: 'atendido' },
        raw: true
      });
      const avgMin = parseFloat(avgResult?.avgMin || 0);
      if (avgMin > 0) {
        const hrs = Math.floor(avgMin / 60);
        const mins = Math.round(avgMin % 60);
        atencionPromedio = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
        atencionSub = `${atendidos} caso${atendidos !== 1 ? 's' : ''} atendido${atendidos !== 1 ? 's' : ''}`;
      }
    }

    const eficiencia = total > 0 ? Math.round((atendidos / total) * 100) : 0;

    res.json({
      porGerencia,
      porEstado,
      diario,
      tendencias,
      total,
      atencionPromedio,
      atencionSub,
      eficiencia: `${eficiencia}%`,
      casosCriticos,
      periodo: { from, to }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== MANTENIMIENTO Y EXPORTACIÓN =====

// GET /api/whatsapp/export/:year/:month — Exportar a CSV
router.get('/export/:year/:month', async (req, res) => {
  const { year, month } = req.params;
  const Model = getModel(req);

  if (!Model) {
    return res.status(500).json({ error: 'Base de datos no disponible' });
  }

  try {
    const { Op } = require('sequelize');
    const tz = await getSystemTimezone();
    const lastDay = new Date(year, month, 0).getDate();
    const { startUtc, endUtc } = getUtcDateRange(
      `${year}-${String(month).padStart(2, '0')}-01`,
      `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      tz
    );

    const whereClause = {
      fecha: { [Op.between]: [startUtc, endUtc] }
    };
    if (req.query.grupo && req.query.grupo !== 'todos') {
      whereClause.grupo = req.query.grupo;
    }

    const reportes = await Model.findAll({
      where: whereClause,
      order: [['fecha', 'ASC']]
    });

    if (reportes.length === 0) {
      return res.status(404).json({ error: 'No hay reportes para este periodo' });
    }

    if (req.query.format === 'json') {
      return res.status(200).json(reportes);
    }

    // Generar CSV manualmente
    const headers = ['ID', 'Fecha', 'Gerencia', 'Categoria', 'Mensaje', 'Prioridad', 'Estado', 'Sector', 'Ubicacion', 'ReportadoPor', 'Telefono'];
    let csv = headers.join(',') + '\n';

    reportes.forEach(r => {
      const row = [
        r.idString,
        r.fecha.toISOString(),
        r.grupo,
        r.categoria,
        `"${(r.mensaje || '').replace(/"/g, '""')}"`,
        r.prioridad,
        r.estado,
        r.sector,
        `"${(r.ubicacion || '').replace(/"/g, '""')}"`,
        `"${(r.reportadoPor || '').replace(/"/g, '""')}"`,
        r.telefono
      ];
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_SGTI_${year}_${month}.csv`);
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/whatsapp/purge/:year/:month — Eliminar registros antiguos
router.delete('/purge/:year/:month', async (req, res) => {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Solo administradores pueden eliminar registros históricos.' });
  }
  const { year, month } = req.params;
  const Model = getModel(req);

  if (!Model) {
    return res.status(500).json({ error: 'Base de datos no disponible' });
  }

  try {
    const { Op } = require('sequelize');
    const tz = await getSystemTimezone();
    const lastDay = new Date(year, month, 0).getDate();
    const { startUtc, endUtc } = getUtcDateRange(
      `${year}-${String(month).padStart(2, '0')}-01`,
      `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      tz
    );

    const whereClause = {
      fecha: { [Op.between]: [startUtc, endUtc] }
    };
    if (req.query.grupo && req.query.grupo !== 'todos') {
      whereClause.grupo = req.query.grupo;
    }

    const deleted = await Model.destroy({
      where: whereClause
    });

    res.json({ message: `Se han eliminado ${deleted} registros del periodo ${month}/${year}.`, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== HELPERS =====

function formatReporteFromDB(msg) {
  const { resolveSector } = require('../utils/sector-resolver');

  // Helper para parsear fotos (Múltiples o Única)
  let fotosProcesadas = [];
  if (msg.fotoUrl) {
    if (msg.fotoUrl.startsWith('[')) {
      try { fotosProcesadas = JSON.parse(msg.fotoUrl).filter(f => f); } catch (e) { fotosProcesadas = [msg.fotoUrl]; }
    } else {
      fotosProcesadas = [msg.fotoUrl];
    }
  }

  const prioridadColor = { Alta: '#f87171', Media: '#fbbf24', Baja: '#34d399' };

  let sectorFinal = msg.sector;
  if (msg.lat && msg.lng && (!sectorFinal || sectorFinal.toLowerCase() === 'sector central' || sectorFinal === '')) {
    const resuelto = resolveSector(msg.lat, msg.lng);
    if (resuelto) sectorFinal = resuelto;
  }

  if (!sectorFinal || sectorFinal.toLowerCase() === 'sector central') {
    sectorFinal = 'Fuera de Jurisdicción';
  }

  return {
    id: msg.idString,
    idString: msg.idString,
    time: getTimeAgo(msg.fecha),
    fecha: msg.fecha,
    grupo: msg.grupo,
    grupoWhatsapp: msg.grupoWhatsapp,
    reportadoPor: msg.reportadoPor,
    sender: msg.reportadoPor || 'Operador',
    body: msg.mensaje,
    telefono: msg.telefono,
    mensaje: msg.mensaje,
    categoria: msg.categoria,
    category: msg.categoria,
    prioridad: msg.prioridad,
    color: prioridadColor[msg.prioridad] || '#fbbf24',
    tags: [msg.prioridad, msg.direccionExtraida ? 'Predio' : 'Zona aprox.'],
    sentiment: msg.prioridad === 'Alta' ? 'negativo' : msg.prioridad === 'Baja' ? 'positivo' : 'neutral',
    sector: sectorFinal,
    ubicacion: msg.ubicacion,
    direccionExtraida: msg.direccionExtraida,
    lat: msg.lat ? parseFloat(msg.lat) : null,
    lng: msg.lng ? parseFloat(msg.lng) : null,
    estado: msg.estado,
    asignadoA: msg.asignadoA,
    notes: msg.notas,
    fotoUrl: msg.fotoUrl, // Mantenemos original por compatibilidad
    fotos: fotosProcesadas, // Nueva propiedad para la galería en el frontend
    areasDerivadas: msg.areasDerivadas ? JSON.parse(msg.areasDerivadas) : [msg.grupo],
    esDerivacionMultiple: msg.esDerivacionMultiple || false,
  };
}

// DELETE /api/whatsapp/reportes/:id — Eliminar un reporte
router.delete('/reportes/:id', async (req, res) => {
  if (!req.user || !['admin', 'gerente', 'supervisor', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permisos para eliminar reportes.' });
  }
  const Model = getModel(req);
  const reportId = req.params.id;

  if (Model && isDbConnected(req)) {
    try {
      const msg = await Model.findOne({ where: { idString: reportId } });
      if (msg) {
        await msg.destroy();
        // Eliminar también de los feeds de memoria (solo del tenant actual)
        const orgPrefix = `${req.organizationId || 'default'}:`;
        Object.keys(whatsappFeeds).filter(k => k.startsWith(orgPrefix)).forEach(k => {
          filterFeed(k, m => !String(m.body).includes(reportId) && m.id !== reportId);
        });
        return res.json({ message: 'Reporte eliminado correctamente' });
      }
    } catch (err) {
      console.error('Error eliminando reporte en BD:', err.message);
      return res.status(500).json({ error: 'Error al eliminar reporte de la base de datos' });
    }
  }

  res.status(404).json({ error: 'Reporte no encontrado' });
});

// DELETE /api/whatsapp/cleanup-demo — Limpieza selectiva de datos del tenant actual
router.delete('/cleanup-demo', async (req, res) => {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Solo administradores pueden limpiar datos.' });
  }
  try {
    // Usar req.models (ya filtrado por organizationId del tenant actual)
    if (!req.models) return res.status(503).json({ error: 'Tenant no resuelto' });
    const { MensajeWhatsapp, Incidencia, Licencia, Inspeccion, Obra } = req.models;

    // Borrar datos del tenant actual — req.models ya tiene organizationId inyectado
    const deletedWsp = await MensajeWhatsapp.destroy({ where: {} });
    await Incidencia?.destroy({ where: {} }).catch(() => {});
    await Licencia?.destroy({ where: {} }).catch(() => {});
    await Inspeccion?.destroy({ where: {} }).catch(() => {});
    await Obra?.destroy({ where: {} }).catch(() => {});

    res.json({ message: `Limpieza exitosa. Se eliminaron ${deletedWsp} reportes del tenant actual.` });
  } catch (err) {
    res.status(500).json({ error: 'Error durante la limpieza: ' + err.message });
  }
});

module.exports = router;
