const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { resolveSector } = require('../utils/sector-resolver');
const { reportes: whatsappReportes, pushToFeed, feedKey } = require('../lib/feedCache');
const { getSystemTimezone, getStartOfDayInTimezone } = require('../utils/timezone');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

function getModels(req) {
  return req.models || null;
}

const { getAreasPermitidas } = require('../utils/gerencia-rbac');

// Middleware para verificar si es gerente o admin
const checkManager = (req, res, next) => {
  if (req.user.rol === 'gerente' || req.user.rol === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Gerente.' });
  }
};

// GET /api/equipo/personal — Lista el personal de la gerencia del usuario actual
router.get('/personal', async (req, res) => {
  const { Usuario, MensajeWhatsapp, Gerencia } = getModels(req);
  try {
    const whereClause = {};

    if (req.user.rol === 'admin') {
      whereClause.rol = 'gerente';
    } else {
      whereClause.rol = { [Op.in]: ['operador', 'visor', 'supervisor'] };

      // Consultar dinámicamente las sub-áreas asociadas a la gerencia del usuario
      const subGerencias = await Gerencia.findAll({
        where: {
          [Op.or]: [
            { clave: req.user.gerencia },
            { parentClave: req.user.gerencia }
          ]
        },
        attributes: ['clave']
      });

      const areasPermitidas = subGerencias.map(g => g.clave);
      if (areasPermitidas.length === 0) {
        areasPermitidas.push(req.user.gerencia);
      }
      whereClause.gerencia = { [Op.in]: areasPermitidas };
    }

    const personal = await Usuario.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'nombre', 'gerencia', 'rol', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    const tz = await getSystemTimezone();
    const hoy = await getStartOfDayInTimezone(tz);

    const personalConConteo = await Promise.all(personal.map(async (u) => {
      const data = u.toJSON();
      if (MensajeWhatsapp) {
        data.reportesHoy = await MensajeWhatsapp.count({
          where: {
            reportadoPor: u.nombre,
            fecha: { [Op.gte]: hoy }
          }
        });
      } else {
        data.reportesHoy = 0;
      }

      global.activeUsers = global.activeUsers || new Map();
      const activeKey = `${req.organizationId || req.tenantInfo?.subdominio}:${u.username}`;
      const lastActive = global.activeUsers.get(activeKey);
      data.online = lastActive ? (Date.now() - lastActive < 120000) : false;
      data.lastActive = lastActive || null;

      return data;
    }));

    res.json(personalConConteo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/equipo/reporte-uso — Obtiene el reporte de uso del aplicativo
router.get('/reporte-uso', async (req, res) => {
  try {
    const { Usuario, MensajeWhatsapp, SesionUsuario, Gerencia } = getModels(req);
    const { Op } = require('sequelize');
    const whereClause = {};

    if (req.user.rol !== 'admin') {
      whereClause.rol = { [Op.in]: ['operador', 'visor', 'supervisor'] };

      // Consultar dinámicamente las sub-áreas asociadas a la gerencia del usuario
      const subGerencias = await Gerencia.findAll({
        where: {
          [Op.or]: [
            { clave: req.user.gerencia },
            { parentClave: req.user.gerencia }
          ]
        },
        attributes: ['clave']
      });

      const areasPermitidas = subGerencias.map(g => g.clave);
      if (areasPermitidas.length === 0) {
        areasPermitidas.push(req.user.gerencia);
      }
      whereClause.gerencia = { [Op.in]: areasPermitidas };
    }

    const personal = await Usuario.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'nombre', 'gerencia', 'rol', 'createdAt'],
      order: [['nombre', 'ASC']]
    });

    const reporteUso = await Promise.all(personal.map(async (u) => {
      const data = {
        nombre: u.nombre,
        username: u.username,
        rol: u.rol === 'admin' ? 'Administrador' : u.rol === 'gerente' ? 'Gerente' : u.rol === 'visor' ? 'Supervisor' : 'Operador',
        gerencia: u.gerencia,
        fechaRegistro: u.createdAt,
        totalReportes: 0,
        ultimoAcceso: null
      };

      if (MensajeWhatsapp) {
        data.totalReportes = await MensajeWhatsapp.count({
          where: { reportadoPor: u.nombre }
        });
      }

      if (SesionUsuario) {
        const ultimaSesion = await SesionUsuario.findOne({
          where: { usuarioId: u.id },
          order: [['inicioSesion', 'DESC']],
          attributes: ['inicioSesion']
        });
        if (ultimaSesion) {
          data.ultimoAcceso = ultimaSesion.inicioSesion;
        }
      }

      return data;
    }));

    res.json(reporteUso);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/equipo/personal/:id/reportes — Obtiene los reportes de un usuario
router.get('/personal/:id/reportes', async (req, res) => {
  try {
    const { Usuario, MensajeWhatsapp } = getModels(req);
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!MensajeWhatsapp) return res.json([]);

    const reportes = await MensajeWhatsapp.findAll({
      where: { reportadoPor: usuario.nombre },
      order: [['fecha', 'DESC']],
      limit: 50
    });

    // Procesar fotos para que el frontend reciba el arreglo 'fotos'
    const formatted = reportes.map(r => {
      const item = r.toJSON();
      let fotosProcesadas = [];
      if (item.fotoUrl) {
        if (item.fotoUrl.startsWith('[')) {
          try { fotosProcesadas = JSON.parse(item.fotoUrl); } catch (e) { fotosProcesadas = [item.fotoUrl]; }
        } else {
          fotosProcesadas = [item.fotoUrl];
        }
      }
      item.fotos = fotosProcesadas;
      return item;
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/equipo/personal — Crea un nuevo usuario operador
router.post('/personal', async (req, res) => {
  const { Usuario } = getModels(req);
  const { username, password, nombre } = req.body;

  if (!username || !password || !nombre) {
    return res.status(400).json({ error: 'Faltan datos (username, password, nombre)' });
  }

  try {
    // La gerencia se toma automáticamente del gerente que lo crea
    const gerencia = req.user.gerencia;

    const hashed = await bcrypt.hash(password, 10);
    // Validación de Jerarquía
    const creatorRole = req.user.rol;
    let targetRol = 'operador';
    let targetGerencia = gerencia;

    // Si es admin, solo puede crear gerentes y asignar cualquier gerencia
    if (creatorRole === 'admin') {
      targetRol = 'gerente';
      targetGerencia = req.body.gerencia || 'municipal';
    } else {
      if (['visor', 'supervisor', 'operador'].includes(req.body.rol)) {
        targetRol = req.body.rol;
      } else {
        targetRol = 'operador';
      }

      const { Gerencia } = getModels(req);
      const areasPermitidas = await getAreasPermitidas(Gerencia, req.user.gerencia);
      targetGerencia = areasPermitidas.includes(req.body.gerencia) ? req.body.gerencia : req.user.gerencia;
    }

    const nuevo = await Usuario.create({
      username,
      password: hashed,
      nombre,
      rol: targetRol,
      gerencia: targetGerencia
    });

    res.json({ message: 'Usuario creado con éxito', id: nuevo.id });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/equipo/personal/:id — Elimina (o desactiva) un usuario
router.delete('/personal/:id', async (req, res) => {
  try {
    const { Usuario, SesionUsuario } = getModels(req);
    const user = await Usuario.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Seguridad: Un gerente solo puede borrar a su propia gente o sub-áreas
    if (req.user.rol !== 'admin') {
      const { Gerencia } = getModels(req);
      const areasPermitidas = await getAreasPermitidas(Gerencia, req.user.gerencia);
      if (!areasPermitidas.includes(user.gerencia)) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar a este usuario' });
      }
    }

    // Eliminar también su historial de sesiones/conexiones
    await SesionUsuario.destroy({ where: { usuarioId: user.id } });

    await user.destroy();
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/equipo/personal/:id — Edita un usuario (cambio de gerente/operador, rotacion de equipo)
router.put('/personal/:id', async (req, res) => {
  if (req.user.rol === 'visor') {
    return res.status(403).json({ error: 'Acceso denegado. No tienes permisos para modificar personal.' });
  }
  const { id } = req.params;
  const { nombre, username, rol, gerencia } = req.body;

  try {
    const { Usuario, MensajeWhatsapp, SesionUsuario, Configuracion } = getModels(req);
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Seguridad: Un gerente solo puede modificar a su propia gente o sub-areas
    if (req.user.rol !== 'admin' && req.user.rol !== 'alcalde') {
      const { Gerencia } = getModels(req);
      const areasPermitidas = await getAreasPermitidas(Gerencia, req.user.gerencia);
      if (!areasPermitidas.includes(user.gerencia)) {
        return res.status(403).json({ error: 'No tienes permiso para modificar a este usuario' });
      }
      if (gerencia && !areasPermitidas.includes(gerencia)) {
        return res.status(403).json({ error: 'No tienes permiso para asignar este area' });
      }
    }

    const oldNombre = user.nombre;
    const oldUsername = user.username;

    // Actualizar campos
    if (nombre) user.nombre = nombre;
    if (username) user.username = username;
    if (rol) {
      if (req.user.rol === 'admin' || req.user.rol === 'alcalde') {
        user.rol = rol;
      } else if (req.user.rol === 'gerente' && ['operador', 'supervisor', 'visor'].includes(rol)) {
        user.rol = rol;
      }
    }
    if (gerencia) user.gerencia = gerencia;

    await user.save();

    // Actualizar en todos lados
    if (nombre && nombre !== oldNombre) {
      // 1. MensajeWhatsapp (reportadoPor)
      if (MensajeWhatsapp) {
        await MensajeWhatsapp.update(
          { reportadoPor: nombre },
          { where: { reportadoPor: oldNombre } }
        );
      }
      // 2. SesionUsuario (nombre)
      if (SesionUsuario) {
        await SesionUsuario.update(
          { nombre: nombre },
          { where: { usuarioId: user.id } }
        );
      }
      // 3. Configuracion (valor)
      if (Configuracion) {
        await Configuracion.update(
          { valor: nombre },
          { where: { valor: oldNombre } }
        );
      }
    }

    if (username && username !== oldUsername) {
      // SesionUsuario (username)
      if (SesionUsuario) {
        await SesionUsuario.update(
          { username: username },
          { where: { usuarioId: user.id } }
        );
      }
    }

    res.json({ message: 'Usuario actualizado con exito', user });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/equipo/personal/:id/reset-password — Restablece la contraseña de un operador/visor
router.patch('/personal/:id/reset-password', async (req, res) => {
  if (req.user.rol === 'visor') {
    return res.status(403).json({ error: 'Acceso denegado. No tienes permisos para modificar personal.' });
  }
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Falta la nueva contraseña' });
  }

  try {
    const { Usuario } = getModels(req);
    const user = await Usuario.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Seguridad: Un gerente solo puede resetear a su propia gente o sub-áreas
    if (req.user.rol !== 'admin') {
      const { Gerencia } = getModels(req);
      const areasPermitidas = await getAreasPermitidas(Gerencia, req.user.gerencia);
      if (!areasPermitidas.includes(user.gerencia)) {
        return res.status(403).json({ error: 'No tienes permiso para modificar a este usuario' });
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: 'Contraseña restablecida con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// SUPERVISORES POR TURNO
// ========================================

// GET /api/equipo/supervisores-turno — Obtener configuración actual
router.get('/supervisores-turno', async (req, res) => {
  try {
    const { Configuracion } = getModels(req);
    const gerencia = req.query.gerencia || req.user?.gerencia;
    const keys = [
      `habilitar_supervisores_${gerencia}`,
      `supervisor_manana_${gerencia}`,
      `supervisor_tarde_${gerencia}`,
      `supervisor_noche_${gerencia}`
    ];
    const configs = await Configuracion.findAll({
      where: { clave: keys }
    });
    const result = {
      habilitar_supervisores: gerencia === 'seguridad' ? 'true' : 'false',
      supervisor_manana: '',
      supervisor_tarde: '',
      supervisor_noche: ''
    };
    configs.forEach(c => {
      const clientKey = c.clave.replace(`_${gerencia}`, '');
      result[clientKey] = c.valor || '';
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipo/supervisores-turno — Guardar configuración de supervisores
router.post('/supervisores-turno', async (req, res) => {
  if (req.user.rol === 'visor') {
    return res.status(403).json({ error: 'Acceso denegado. No tienes permisos para configurar supervisores.' });
  }
  const { habilitar_supervisores, supervisor_manana, supervisor_tarde, supervisor_noche } = req.body;
  const gerencia = req.query.gerencia || req.user?.gerencia;

  try {
    const { Configuracion } = getModels(req);
    const turnos = [
      { clave: `habilitar_supervisores_${gerencia}`, valor: String(habilitar_supervisores || 'false') },
      { clave: `supervisor_manana_${gerencia}`, valor: supervisor_manana || '' },
      { clave: `supervisor_tarde_${gerencia}`, valor: supervisor_tarde || '' },
      { clave: `supervisor_noche_${gerencia}`, valor: supervisor_noche || '' }
    ];

    for (const t of turnos) {
      await Configuracion.upsert({
        clave: t.clave,
        valor: t.valor,
        gerencia: gerencia
      });
    }

    res.json({ message: 'Supervisores de turno actualizados con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/equipo/timezone — Obtener zona horaria del sistema
router.get('/timezone', async (req, res) => {
  try {
    const tz = await getSystemTimezone();
    res.json({ timezone: tz });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipo/timezone — Guardar configuración de zona horaria (Solo Admin)
router.post('/timezone', async (req, res) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes.' });
  }
  const { timezone } = req.body;
  try {
    const { Configuracion } = getModels(req);
    await Configuracion.upsert({
      clave: 'system_timezone',
      valor: timezone || 'America/Lima'
    });
    res.json({ message: 'Zona horaria configurada con éxito', timezone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware para verificar si es administrador o alcalde
const checkAdmin = (req, res, next) => {
  if (req.user && (req.user.rol === 'admin' || req.user.rol === 'alcalde')) {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador o Alcalde.' });
  }
};

// Helper: obtiene la ruta de datos del tenant actual, creando la carpeta si no existe
function getTenantDataDir(req) {
  const subdominio = req.tenantInfo?.subdominio || 'default';
  const dir = path.join(__dirname, '../public/data/tenants', subdominio);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// POST /api/equipo/upload-geojson — Guardar archivo de límites territoriales Sectores.geojson (Solo Admin)
router.post('/upload-geojson', checkAdmin, async (req, res) => {
  try {
    const geojson = req.body;

    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      return res.status(400).json({ error: 'El archivo no tiene un formato GeoJSON FeatureCollection de Sectores válido.' });
    }

    const geojsonPath = path.join(getTenantDataDir(req), 'Sectores.geojson');

    // Guardar en el directorio público del servidor
    fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2), 'utf8');

    // Limpiar caché en memoria para que se aplique de inmediato en los reportes entrantes
    try {
      const sectorResolver = require('../utils/sector-resolver');
      if (sectorResolver.clearCache) {
        sectorResolver.clearCache();
      }
    } catch (e) {
      console.warn('No se pudo limpiar la caché de sectores:', e.message);
    }

    res.json({ message: 'Límites territoriales actualizados con éxito en el servidor.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipo/clear-geojson — Limpiar el mapa y restablecer a vacío (Solo Admin)
router.post('/clear-geojson', checkAdmin, async (req, res) => {
  try {
    const geojsonPath = path.join(getTenantDataDir(req), 'Sectores.geojson');
    const emptyGeoJSON = {
      type: "FeatureCollection",
      name: "Sectores",
      crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
      features: []
    };
    
    fs.writeFileSync(geojsonPath, JSON.stringify(emptyGeoJSON, null, 2), 'utf8');

    // Limpiar caché en memoria
    try {
      const sectorResolver = require('../utils/sector-resolver');
      if (sectorResolver.clearCache) {
        sectorResolver.clearCache();
      }
    } catch (e) {
      console.warn('No se pudo limpiar la caché de sectores:', e.message);
    }

    res.json({ message: 'Límites territoriales eliminados con éxito. El mapa está ahora en blanco.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/equipo/gerencias — Listar todas las gerencias y sub-áreas
router.get('/gerencias', async (req, res) => {
  const { Gerencia } = getModels(req);
  try {
    const gerencias = await Gerencia.findAll({ order: [['orden', 'ASC']] });
    res.json(gerencias);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipo/gerencias — Crear una nueva gerencia/sub-área (Solo Admin)
router.post('/gerencias', checkAdmin, async (req, res) => {
  const { Gerencia } = getModels(req);
  const { clave, nombre, icono, color, esSubArea, parentClave, orden } = req.body;
  if (!clave || !nombre) {
    return res.status(400).json({ error: 'Faltan datos (clave, nombre)' });
  }
  try {
    const nueva = await Gerencia.create({ clave, nombre, icono, color, esSubArea, parentClave, orden });
    res.json({ message: 'Gerencia creada con éxito', id: nueva.id });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El identificador clave ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/equipo/gerencias/:id — Editar una gerencia/sub-área (Solo Admin)
router.put('/gerencias/:id', checkAdmin, async (req, res) => {
  const { Gerencia } = getModels(req);
  const { nombre, icono, color, parentClave, orden } = req.body;
  try {
    const gerencia = await Gerencia.findByPk(req.params.id);
    if (!gerencia) return res.status(404).json({ error: 'Gerencia no encontrada' });
    
    if (nombre) gerencia.nombre = nombre;
    if (icono) gerencia.icono = icono;
    if (color) gerencia.color = color;
    if (parentClave !== undefined) gerencia.parentClave = parentClave;
    if (orden !== undefined) gerencia.orden = orden;
    
    await gerencia.save();
    res.json({ message: 'Gerencia actualizada con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/equipo/gerencias/:id — Eliminar una gerencia/sub-área (Solo Admin)
router.delete('/gerencias/:id', checkAdmin, async (req, res) => {
  const { Gerencia, Usuario, MensajeWhatsapp } = getModels(req);
  try {
    const gerencia = await Gerencia.findByPk(req.params.id);
    if (!gerencia) return res.status(404).json({ error: 'Gerencia no encontrada' });

    // Validar si hay usuarios vinculados a esta gerencia
    const usuariosAsociados = await Usuario.count({ where: { gerencia: gerencia.clave } });
    if (usuariosAsociados > 0) {
      return res.status(400).json({ error: 'No se puede eliminar la gerencia porque tiene usuarios registrados en ella.' });
    }

    // Validar si hay reportes asociados a esta gerencia
    if (MensajeWhatsapp) {
      const reportesAsociados = await MensajeWhatsapp.count({ where: { grupo: gerencia.clave } });
      if (reportesAsociados > 0) {
        return res.status(400).json({ error: 'No se puede eliminar la gerencia porque tiene reportes asociados en el historial.' });
      }
    }

    await gerencia.destroy();
    res.json({ message: 'Gerencia eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/equipo/geojson/:gerencia — Obtener GeoJSON de sectores de una gerencia
router.get('/geojson/:gerencia', async (req, res) => {
  try {
    const gerencia = req.params.gerencia;
    if (!/^[a-zA-Z0-9_-]+$/.test(gerencia)) {
      return res.status(400).json({ error: 'Nombre de gerencia inválido.' });
    }

    const tenantDir = getTenantDataDir(req);
    let geojsonPath = path.join(tenantDir, `Sectores_${gerencia}.geojson`);
    if (!fs.existsSync(geojsonPath)) geojsonPath = path.join(tenantDir, 'Sectores.geojson');
    // Sin fallback global: cada tenant tiene sus propios sectores o ninguno
    if (fs.existsSync(geojsonPath)) {
      const data = fs.readFileSync(geojsonPath, 'utf8');
      return res.json(JSON.parse(data));
    }
    
    res.json({
      type: "FeatureCollection",
      name: "Sectores",
      features: []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipo/geojson/:gerencia — Guardar GeoJSON de sectores personalizado por gerencia
router.post('/geojson/:gerencia', checkManager, async (req, res) => {
  const { Gerencia } = getModels(req);
  try {
    const gerencia = req.params.gerencia;
    if (!/^[a-zA-Z0-9_-]+$/.test(gerencia)) {
      return res.status(400).json({ error: 'Nombre de gerencia inválido.' });
    }
    
    // Un gerente solo puede editar su propia gerencia o sus subgerencias
    if (req.user.rol !== 'admin' && req.user.gerencia !== gerencia) {
      const subGerencias = await Gerencia.findAll({
        where: { parentClave: req.user.gerencia },
        attributes: ['clave']
      });
      const subClaves = subGerencias.map(sg => sg.clave);
      if (!subClaves.includes(gerencia)) {
        return res.status(403).json({ error: 'No tienes permiso para modificar la sectorización de esta gerencia.' });
      }
    }
    
    const geojson = req.body;
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      return res.status(400).json({ error: 'El archivo no tiene un formato GeoJSON FeatureCollection válido.' });
    }
    
    const geojsonPath = path.join(getTenantDataDir(req), `Sectores_${gerencia}.geojson`);
    fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2), 'utf8');
    
    // Limpiar caché
    try {
      const sectorResolver = require('../utils/sector-resolver');
      if (sectorResolver.clearCache) {
        sectorResolver.clearCache();
      }
    } catch (e) {}
    
    res.json({ message: 'Límites territoriales de la gerencia actualizados con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/equipo/geojson/:gerencia — Restablecer/eliminar GeoJSON de sectores personalizado
router.delete('/geojson/:gerencia', checkManager, async (req, res) => {
  try {
    const gerencia = req.params.gerencia;
    if (!/^[a-zA-Z0-9_-]+$/.test(gerencia)) {
      return res.status(400).json({ error: 'Nombre de gerencia inválido.' });
    }
    
    if (req.user.rol !== 'admin' && req.user.gerencia !== gerencia) {
      const subGerencias = await Gerencia.findAll({
        where: { parentClave: req.user.gerencia },
        attributes: ['clave']
      });
      const subClaves = subGerencias.map(sg => sg.clave);
      if (!subClaves.includes(gerencia)) {
        return res.status(403).json({ error: 'No tienes permiso para modificar la sectorización de esta gerencia.' });
      }
    }
    
    const geojsonPath = path.join(__dirname, `../public/data/Sectores_${gerencia}.geojson`);
    if (fs.existsSync(geojsonPath)) {
      fs.unlinkSync(geojsonPath);
    }
    
    try {
      const sectorResolver = require('../utils/sector-resolver');
      if (sectorResolver.clearCache) {
        sectorResolver.clearCache();
      }
    } catch (e) {}
    
    res.json({ message: 'Límites territoriales de esta gerencia restablecidos al mapa general.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipo/incidencia-web — Crear incidencia desde la web por cualquier gerencia
router.post('/incidencia-web', async (req, res) => {
  try {
    const { Gerencia, Configuracion, MensajeWhatsapp } = getModels(req);
    const { lat, lng, categoria, mensaje, prioridad, ubicacion } = req.body;
    if (!lat || !lng || !categoria || !mensaje) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: lat, lng, categoria, mensaje' });
    }

    const user = req.user;
    const gerencia = user.gerencia || 'municipal';
    const id = 'WEB-' + String(Date.now()).slice(-6);

    // Resolver sector por coordenadas
    const sectorResuelto = resolveSector(parseFloat(lat), parseFloat(lng)) || 'Fuera de Jurisdicción';

    // Obtener nombre de la gerencia para el grupo
    let grupoNombre = gerencia;
    try {
      const gerObj = await Gerencia.findOne({ where: { clave: gerencia } });
      if (gerObj) grupoNombre = gerObj.nombre || gerencia;
    } catch (e) {}

    // Buscar supervisor de turno
    let supervisorAsignado = null;
    try {
      const hora = new Date().getHours();
      let claveTurno = 'supervisor_noche';
      if (hora >= 6 && hora < 14) claveTurno = 'supervisor_manana';
      else if (hora >= 14 && hora < 22) claveTurno = 'supervisor_tarde';

      if (Configuracion) {
        const habilitado = await Configuracion.findOne({ where: { clave: `habilitar_supervisores_${gerencia}` } });
        const isHabilitado = habilitado ? (habilitado.valor === 'true') : (gerencia === 'seguridad');
        if (isHabilitado) {
          const config = await Configuracion.findOne({ where: { clave: `${claveTurno}_${gerencia}` } });
          if (config && config.valor) supervisorAsignado = config.valor;
        }
      }
    } catch (e) {}

    const nuevoReporte = {
      idString: id,
      fecha: new Date(),
      grupo: gerencia,
      grupoWhatsapp: 'Web',
      reportadoPor: user.nombre || user.username || 'Operador Web',
      mensaje: `[WEB] ${mensaje}`,
      categoria: categoria,
      prioridad: prioridad || 'Media',
      sector: sectorResuelto,
      ubicacion: ubicacion || sectorResuelto,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      estado: 'nuevo',
      fotoUrl: null,
      areasDerivadas: JSON.stringify([gerencia]),
      esDerivacionMultiple: false,
      supervisor: supervisorAsignado
    };

    // Sincronizar con feed en vivo en memoria (tenant-scoped)
    pushToFeed(feedKey(req.organizationId, gerencia), {
      id,
      time: 'Ahora',
      fecha: nuevoReporte.fecha,
      sender: nuevoReporte.reportadoPor,
      body: nuevoReporte.mensaje,
      tags: [nuevoReporte.prioridad, 'Web'],
      color: nuevoReporte.prioridad === 'Alta' ? '#f87171' : '#fbbf24',
      category: nuevoReporte.categoria,
      estado: nuevoReporte.estado,
      lat: nuevoReporte.lat,
      lng: nuevoReporte.lng,
      ubicacion: nuevoReporte.ubicacion
    });

    if (MensajeWhatsapp) {
      const reporte = await MensajeWhatsapp.create(nuevoReporte);
      return res.status(201).json({ message: 'Incidencia creada con éxito', id: reporte.idString, sector: sectorResuelto });
    } else {
      whatsappReportes.unshift({ id, ...nuevoReporte, areasDerivadas: [gerencia] });
      return res.status(201).json({ message: 'Incidencia creada (Modo Memoria)', id, sector: sectorResuelto });
    }
  } catch (err) {
    console.error('[WEB-INCIDENCIA] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
