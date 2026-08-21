const { Organizacion, getScopedModels } = require('../database/unified');

// Caché de organizaciones para no golpear la BD en cada request
const orgCache = new Map();
const CACHE_TTL = 60_000; // 1 minuto

async function getOrganizacion(subdominio) {
  const cached = orgCache.get(subdominio);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.org;

  const org = await Organizacion.findOne({ where: { subdominio } });
  if (org) orgCache.set(subdominio, { org, ts: Date.now() });
  return org;
}

module.exports = async function tenantConnection(req, res, next) {
  if (req.path.startsWith('/superadmin')) return next();

  // Detectar subdominio desde el host (carmen.gobernanzamunicipal.com → "carmen")
  let subdominio = '';
  const host = req.headers.host || '';
  const hostBase = host.split(':')[0]; // quitar puerto si lo hay

  // ?tenant= permitido desde app.gobernanzamunicipal.com (app móvil) o en desarrollo local
  const isAppHost = hostBase === 'app.gobernanzamunicipal.com';
  if (req.query.tenant && (process.env.NODE_ENV !== 'production' || isAppHost)) {
    subdominio = req.query.tenant.toLowerCase();
  } else if (hostBase.includes('.') && !hostBase.startsWith('localhost') && !hostBase.startsWith('127.0.0.1')) {
    const parts = hostBase.split('.');
    const first = parts[0].toLowerCase();
    if (first !== 'app' && first !== 'www') subdominio = first;
  }

  if (!subdominio) {
    // Login desde la app móvil (app.gobernanzamunicipal.com) sin tenant: permitir y dejar que auth.js resuelva por credenciales
    if (isAppHost && req.path === '/auth/login' && req.method === 'POST') {
      req.tenantInfo = null;
      req.models = null;
      req.organizationId = null;
      return next();
    }
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Use la URL de su municipio (ej: carmen.gobernanzamunicipal.com).' });
    }
    subdominio = 'demo'; // fallback solo en desarrollo local
  }

  try {
    const org = await getOrganizacion(subdominio);
    if (!org) {
      return res.status(404).json({ error: `Municipalidad '${subdominio}' no registrada.` });
    }

    if (org.estado === 'suspendido') {
      if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: 'Este municipio está suspendido. Contacte al administrador.' });
      }
      return res.status(403).send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acceso suspendido — ${org.nombre}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
    .card{background:#1e293b;border:1px solid #334155;border-radius:1.5rem;padding:3rem 2.5rem;max-width:480px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.5)}
    .icon{font-size:4rem;margin-bottom:1.5rem}
    h1{font-size:1.5rem;font-weight:700;color:#f8fafc;margin-bottom:.75rem}
    p{color:#94a3b8;line-height:1.6;margin-bottom:.5rem}
    .org{color:#60a5fa;font-weight:600}
    .footer{margin-top:2rem;font-size:.8rem;color:#475569}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>Acceso suspendido</h1>
    <p>La <span class="org">${org.nombre}</span> tiene el acceso al sistema temporalmente suspendido.</p>
    <p>Si cree que esto es un error, comuníquese con el administrador del sistema.</p>
    <div class="footer">SGTI Municipal © ${new Date().getFullYear()}</div>
  </div>
</body>
</html>`);
    }

    req.tenantInfo = {
      nombre: org.nombre,
      subdominio: org.subdominio,
      logoUrl: org.logoUrl,
      suspended: false,
    };

    req.organizationId = org.id;
    req.models = getScopedModels(org.id);

    next();
  } catch (err) {
    console.error(`[tenantConnection] Error para subdominio [${subdominio}]:`, err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// Limpiar caché de una org (al suspender, editar, etc.)
module.exports.clearOrgCache = (subdominio) => orgCache.delete(subdominio);
