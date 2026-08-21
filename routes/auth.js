const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { SuperAdmin, ALL_MODELS } = require('../database/unified');
const { Op } = require('sequelize');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espere 15 minutos e intente nuevamente.' },
});

const ROLES_PERMITIDOS = ['operador', 'visor', 'supervisor'];

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password son requeridos' });
    }

    // 1. SuperAdmin
    const superadmin = await SuperAdmin.findOne({ where: { username } });
    if (superadmin) {
      const valid = await bcrypt.compare(password, superadmin.password);
      if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });
      const token = jwt.sign(
        { id: superadmin.id, username: superadmin.username, nombre: superadmin.nombre, rol: 'superadmin', gerencia: 'all' },
        JWT_SECRET, { expiresIn: JWT_EXPIRES }
      );
      return res.json({ token, user: { id: superadmin.id, username: superadmin.username, nombre: superadmin.nombre, rol: 'superadmin', gerencia: 'all' } });
    }

    // 2. Usuario municipal
    if (req.tenantInfo?.suspended) {
      return res.status(403).json({ error: 'Este servicio está suspendido.', status: 'suspended' });
    }

    let user = null;
    let tenantSubdominio = req.tenantInfo?.subdominio || null;

    if (tenantSubdominio) {
      // Tenant conocido — buscar solo en esa organización
      user = await req.models.Usuario.findOne({ where: { username } });
    } else {
      // Sin tenant — buscar en todas las organizaciones (para APK sin campo municipio)
      user = await ALL_MODELS.Usuario.findOne({ where: { username } });
      if (user) tenantSubdominio = user.organizationId;
    }

    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (user.habilitado === false) return res.status(403).json({ error: 'Cuenta deshabilitada.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    if (!tenantSubdominio) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol, gerencia: user.gerencia, tenant: tenantSubdominio },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );

    if (user.rol === 'operador') {
      req.models?.SesionUsuario?.create({ usuarioId: user.id, username: user.username, nombre: user.nombre, gerencia: user.gerencia, inicioSesion: new Date() }).catch(() => {});
    }

    return res.json({ token, user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol, gerencia: user.gerencia }, tenant: tenantSubdominio });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autenticado' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    res.json({ user: decoded });
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// POST /api/auth/register — requiere admin o superadmin
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const callerRol = req.user?.rol;
    if (!['admin', 'superadmin'].includes(callerRol)) {
      return res.status(403).json({ error: 'Solo administradores pueden crear usuarios.' });
    }
    const { username, password, nombre, rol, gerencia } = req.body;
    if (!username || !password || !nombre) {
      return res.status(400).json({ error: 'username, password y nombre son requeridos.' });
    }
    const rolFinal = rol || 'visor';
    if (!ROLES_PERMITIDOS.includes(rolFinal) && callerRol !== 'superadmin') {
      return res.status(400).json({ error: `Rol inválido. Permitidos: ${ROLES_PERMITIDOS.join(', ')}.` });
    }
    const existing = await req.models.Usuario.findOne({ where: { username } });
    if (existing) return res.status(400).json({ error: 'El usuario ya existe.' });
    const hashed  = await bcrypt.hash(password, 10);
    const newUser = await req.models.Usuario.create({ username, password: hashed, nombre, rol: rolFinal, gerencia: gerencia || 'all' });
    res.status(201).json({ message: 'Usuario creado', user: { id: newUser.id, username, nombre, rol: newUser.rol, gerencia: newUser.gerencia } });
  } catch (err) {
    console.error('Error en register:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      if (decoded?.username && global.activeUsers) {
        const activeKey = `${decoded.tenant || 'superadmin'}:${decoded.username}`;
        global.activeUsers.delete(activeKey);
      }
      if (decoded?.rol === 'operador') {
        req.models.SesionUsuario.update({ finSesion: new Date() }, { where: { usuarioId: decoded.id, finSesion: null } }).catch(() => {});
      }
    } catch {}
  }
  res.json({ message: 'Sesión cerrada' });
});

// GET /api/auth/sesiones — requiere gerente o admin
router.get('/sesiones', authMiddleware, async (req, res) => {
  if (!['admin', 'gerente', 'superadmin'].includes(req.user?.rol)) {
    return res.status(403).json({ error: 'Sin permisos para ver el historial de sesiones.' });
  }
  try {
    const sesiones = await req.models.SesionUsuario.findAll({ order: [['inicioSesion', 'DESC']], limit: 100 });
    res.json(sesiones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
