const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Bloquear rutas protegidas si el tenant está suspendido
    if (decoded.rol !== 'superadmin' && req.tenantInfo?.suspended) {
      return res.status(403).json({
        error: 'El servicio de esta municipalidad está suspendido. Comuníquese con el administrador del sistema.',
        status: 'suspended'
      });
    }

    // Validar aislamiento de tenant en tokens de usuarios municipales
    if (decoded.rol !== 'superadmin') {
      if (!decoded.tenant) {
        return res.status(401).json({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
      }
      if (req.tenantInfo && decoded.tenant !== req.tenantInfo.subdominio) {
        return res.status(401).json({ error: 'Sesión no válida para esta municipalidad. Inicia sesión nuevamente.' });
      }
    }

    req.user = decoded;

    if (decoded && decoded.username) {
      global.activeUsers = global.activeUsers || new Map();
      const activeKey = `${decoded.tenant || 'superadmin'}:${decoded.username}`;
      global.activeUsers.set(activeKey, Date.now());
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { authMiddleware };
