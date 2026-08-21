const express   = require('express');
const router    = express.Router();
const { Organizacion, SuperAdmin, getScopedModels } = require('../database/unified');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const multer    = require('multer');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const fs        = require('fs');
const { clearOrgCache } = require('../middlewares/tenantConnection');

const JWT_SECRET = process.env.JWT_SECRET;

const saLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espere 15 minutos.' },
});

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/logos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo_${req.query.subdominio || Date.now()}${ext}`);
  }
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo imágenes'));
    cb(null, true);
  }
});

const verifySuperAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    if (decoded.rol !== 'superadmin') return res.status(403).json({ error: 'Acceso denegado.' });
    req.superadmin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// POST /api/superadmin/upload-logo
router.post('/upload-logo', verifySuperAdmin, uploadLogo.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });
  res.json({ url: `/uploads/logos/${req.file.filename}` });
});

// GET /api/escudo-lookup?dist=puno&prov=puno  — búsqueda sin auth para el form
router.get('/escudo-lookup', (req, res) => {
  const norm = (s) => (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const dist = norm(req.query.dist || '');
  const prov = norm(req.query.prov || '');
  if (!dist) return res.json({ url: null });

  const escudosDir = path.join(__dirname, '../public/escudos');
  const exts = ['svg', 'png', 'jpg'];

  // Si hay provincia, buscar nombre exacto primero
  if (prov) {
    const key = `${dist}_${prov}`;
    for (const ext of exts) {
      if (fs.existsSync(path.join(escudosDir, `${key}.${ext}`))) {
        return res.json({ url: `/escudos/${key}.${ext}` });
      }
    }
  }

  // Fallback: buscar cualquier archivo que empiece con {dist}_
  try {
    const files = fs.readdirSync(escudosDir);
    const prefix = `${dist}_`;
    for (const ext of exts) {
      const match = files.find(f => f.startsWith(prefix) && f.endsWith(`.${ext}`));
      if (match) return res.json({ url: `/escudos/${match}` });
    }
  } catch(e) {}

  res.json({ url: null });
});

// GET /api/superadmin/tenants
router.get('/tenants', verifySuperAdmin, async (req, res) => {
  try {
    const orgs = await Organizacion.findAll({ order: [['createdAt', 'ASC']] });
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/tenants — Crear municipio nuevo
router.post('/tenants', verifySuperAdmin, async (req, res) => {
  try {
    const { nombre, subdominio, plan, estado, logoUrl, nombreProvincia, primaryColor, adminUser, adminPassword } = req.body;
    if (!nombre || !subdominio) {
      return res.status(400).json({ error: 'nombre y subdominio son requeridos.' });
    }

    const slug = subdominio.toLowerCase().trim();
    const id = slug; // el id es el mismo subdominio

    const nueva = await Organizacion.create({ id, nombre, subdominio: slug, plan: plan || 'BASIC', estado: estado || 'activo', logoUrl, nombreProvincia: nombreProvincia || null, primaryColor });

    // Crear usuario admin inicial en la BD unificada
    const user = adminUser || 'admin';
    const pass = adminPassword || 'sgti2026';
    const models = getScopedModels(id);
    await models.Usuario.create({
      username: user,
      password: await bcrypt.hash(pass, 10),
      nombre: 'Administrador Municipal',
      rol: 'admin',
      gerencia: 'all',
    });

    res.status(201).json({ ...nueva.toJSON(), adminUser: user, adminPassword: pass });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ error: 'El subdominio ya existe.' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/superadmin/tenants/:id
router.put('/tenants/:id', verifySuperAdmin, async (req, res) => {
  try {
    const org = await Organizacion.findByPk(req.params.id);
    if (!org) return res.status(404).json({ error: 'Municipio no encontrado.' });

    const { nombre, estado, logoUrl, nombreProvincia, primaryColor, plan, adminUser, adminPassword } = req.body;
    if (nombre) org.nombre = nombre;
    if (estado) org.estado = estado;
    if (logoUrl !== undefined) org.logoUrl = logoUrl;
    if (nombreProvincia !== undefined) org.nombreProvincia = nombreProvincia || null;
    if (primaryColor) org.primaryColor = primaryColor;
    if (plan) org.plan = plan;

    await org.save();
    clearOrgCache(org.subdominio);

    // Actualizar credenciales del admin si se proporcionaron
    if (adminUser || adminPassword) {
      const models = getScopedModels(org.id);
      const adminU = await models.Usuario.findOne({ where: { rol: 'admin' } });
      if (adminU) {
        const upd = {};
        if (adminUser && adminUser.trim()) upd.username = adminUser.trim();
        if (adminPassword && adminPassword.length >= 4) upd.password = await bcrypt.hash(adminPassword, 10);
        if (Object.keys(upd).length) await models.Usuario.update(upd, { where: { id: adminU.id } });
      }
    }

    res.json(org);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/superadmin/tenants/:id/usuarios
router.get('/tenants/:id/usuarios', verifySuperAdmin, async (req, res) => {
  try {
    const models = getScopedModels(req.params.id);
    const usuarios = await models.Usuario.findAll({ order: [['rol', 'ASC'], ['username', 'ASC']] });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/superadmin/tenants/:id/usuarios/:userId
router.patch('/tenants/:id/usuarios/:userId', verifySuperAdmin, async (req, res) => {
  try {
    const models = getScopedModels(req.params.id);
    const usuario = await models.Usuario.findByPk(req.params.userId);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const { habilitado } = req.body;
    if (typeof habilitado !== 'boolean') return res.status(400).json({ error: 'habilitado debe ser boolean.' });

    await models.Usuario.update({ habilitado }, { where: { id: req.params.userId } });
    res.json({ mensaje: `Usuario ${usuario.username} ${habilitado ? 'habilitado' : 'deshabilitado'}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/superadmin/tenants/:id/usuarios/:userId — cambiar username y/o contraseña
router.put('/tenants/:id/usuarios/:userId', verifySuperAdmin, async (req, res) => {
  try {
    const models = getScopedModels(req.params.id);
    const usuario = await models.Usuario.findByPk(req.params.userId);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const updates = {};
    const { username, password } = req.body;

    if (username && username.trim()) {
      const existing = await models.Usuario.findOne({ where: { username: username.trim() } });
      if (existing && String(existing._raw?.id || existing.id) !== String(req.params.userId)) {
        return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso.' });
      }
      updates.username = username.trim();
    }
    if (password && password.length >= 8) {
      updates.password = await bcrypt.hash(password, 10);
    } else if (password) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nada que actualizar.' });

    await models.Usuario.update(updates, { where: { id: req.params.userId } });
    res.json({ mensaje: 'Usuario actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/superadmin/tenants/:id — Eliminar municipio y todos sus datos
router.delete('/tenants/:id', verifySuperAdmin, async (req, res) => {
  try {
    const org = await Organizacion.findByPk(req.params.id);
    if (!org) return res.status(404).json({ error: 'Municipio no encontrado.' });

    const orgId = org.id;
    const { ALL_MODELS } = require('../database/unified');

    // Borrar todos los datos con ese organizationId
    for (const Model of Object.values(ALL_MODELS)) {
      await Model.destroy({ where: { organizationId: orgId }, force: true }).catch(() => {});
    }

    // Borrar la organización
    await org.destroy();
    clearOrgCache(orgId);

    // Borrar carpeta GeoJSON del tenant
    const tenantDir = path.join(__dirname, `../public/data/tenants/${orgId}`);
    if (fs.existsSync(tenantDir)) fs.rmSync(tenantDir, { recursive: true, force: true });

    // Borrar logo si existe
    const logosDir = path.join(__dirname, '../public/uploads/logos');
    ['png','jpg','jpeg','webp','svg','gif'].forEach(ext => {
      const p = path.join(logosDir, `logo_${orgId}.${ext}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    res.json({ ok: true, mensaje: `Municipio "${org.nombre}" eliminado correctamente.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/tenants/:id/geojson — Guardar sectores GeoJSON generados automáticamente
router.post('/tenants/:id/geojson', verifySuperAdmin, async (req, res) => {
  try {
    const org = await Organizacion.findByPk(req.params.id);
    if (!org) return res.status(404).json({ error: 'Municipio no encontrado.' });

    const { geojson } = req.body;
    if (!geojson || geojson.type !== 'FeatureCollection') {
      return res.status(400).json({ error: 'GeoJSON FeatureCollection requerido.' });
    }

    const safeId = String(org.subdominio).replace(/[^a-z0-9_-]/gi, '');
    const dir = path.join(__dirname, '../public/data/tenants', safeId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const str = JSON.stringify(geojson, null, 2);
    fs.writeFileSync(path.join(dir, 'Sectores.geojson'), str);
    fs.writeFileSync(path.join(dir, 'Sectores_all.geojson'), str);
    fs.writeFileSync(path.join(dir, 'Sectores_seguridad.geojson'), str);

    res.json({ ok: true, sectores: geojson.features?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/login
router.post('/login', saLoginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan campos.' });
    const sa = await SuperAdmin.findOne({ where: { username } });
    if (!sa || !await bcrypt.compare(password, sa.password)) return res.status(401).json({ error: 'Credenciales inválidas.' });
    const token = jwt.sign({ id: sa.id, username: sa.username, nombre: sa.nombre, rol: 'superadmin', gerencia: 'all' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: sa.id, username: sa.username, nombre: sa.nombre, rol: 'superadmin' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/impersonate/:subdominio
router.post('/impersonate/:subdominio', async (req, res) => {
  try {
    const decoded = jwt.verify(req.headers.authorization?.split(' ')[1], JWT_SECRET);
    if (decoded.rol !== 'superadmin') return res.status(403).json({ error: 'Solo superadmin.' });
  } catch {
    return res.status(401).json({ error: 'Token inválido.' });
  }
  try {
    const { subdominio } = req.params;
    const org = await Organizacion.findOne({ where: { subdominio } });
    if (!org) return res.status(404).json({ error: 'Municipio no encontrado.' });
    if (org.estado !== 'activo') return res.status(400).json({ error: 'Municipio suspendido.' });

    const models = getScopedModels(org.id);
    const adminUser = await models.Usuario.findOne({ where: { rol: 'admin' } });
    if (!adminUser) return res.status(404).json({ error: 'No hay admin en ese municipio.' });

    const token = jwt.sign(
      { id: adminUser.id, username: adminUser.username, nombre: adminUser.nombre, rol: adminUser.rol, gerencia: adminUser.gerencia || 'all', tenant: subdominio },
      JWT_SECRET, { expiresIn: '8h' }
    );
    res.json({ token, tenant: subdominio, nombre: org.nombre, user: { id: adminUser.id, username: adminUser.username, nombre: adminUser.nombre, rol: adminUser.rol, gerencia: adminUser.gerencia || 'all' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/superadmin/analytics
router.get('/analytics', verifySuperAdmin, async (req, res) => {
  try {
    const { sequelize } = require('../database/unified');
    const orgs = await Organizacion.findAll({ order: [['createdAt', 'ASC']] });

    const pad = n => String(n).padStart(2, '0');
    const lima = new Date(Date.now() - 5 * 3600 * 1000);
    const hoy     = `${lima.getUTCFullYear()}-${pad(lima.getUTCMonth()+1)}-${pad(lima.getUTCDate())} 00:00:00`;
    const manana  = new Date(lima); manana.setUTCDate(manana.getUTCDate() + 1);
    const mananaS = `${manana.getUTCFullYear()}-${pad(manana.getUTCMonth()+1)}-${pad(manana.getUTCDate())} 00:00:00`;
    const mesInicio = `${lima.getUTCFullYear()}-${pad(lima.getUTCMonth()+1)}-01 00:00:00`;

    const tenantStats = await Promise.all(orgs.map(async org => {
      const base = { id: org.id, nombre: org.nombre, subdominio: org.subdominio, estado: org.estado, totalReportes: 0, reportesHoy: 0, reportesMes: 0, usuarios: 0, porEstado: [], ultimaActividad: null };
      if (org.estado !== 'activo') return base;
      try {
        const [total, hoyR, mesR, users, estados, ultimo] = await Promise.all([
          sequelize.query('SELECT COUNT(*) as n FROM MensajeWhatsapps WHERE organizationId=?', { replacements: [org.id], type: 'SELECT' }),
          sequelize.query('SELECT COUNT(*) as n FROM MensajeWhatsapps WHERE organizationId=? AND fecha>=? AND fecha < ?', { replacements: [org.id, hoy, mananaS], type: 'SELECT' }),
          sequelize.query('SELECT COUNT(*) as n FROM MensajeWhatsapps WHERE organizationId=? AND fecha>=?', { replacements: [org.id, mesInicio], type: 'SELECT' }),
          sequelize.query('SELECT COUNT(*) as n FROM Usuarios WHERE organizationId=? AND habilitado=1', { replacements: [org.id], type: 'SELECT' }),
          sequelize.query('SELECT estado, COUNT(*) as n FROM MensajeWhatsapps WHERE organizationId=? GROUP BY estado', { replacements: [org.id], type: 'SELECT' }),
          sequelize.query('SELECT fecha FROM MensajeWhatsapps WHERE organizationId=? ORDER BY fecha DESC LIMIT 1', { replacements: [org.id], type: 'SELECT' }),
        ]);
        return { ...base, totalReportes: +total[0]?.n||0, reportesHoy: +hoyR[0]?.n||0, reportesMes: +mesR[0]?.n||0, usuarios: +users[0]?.n||0, porEstado: estados.map(e=>({estado:e.estado||'nuevo',total:+e.n||0})), ultimaActividad: ultimo[0]?.fecha||null };
      } catch { return { ...base, error: true }; }
    }));

    res.json({ tenants: tenantStats, generatedAt: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
