const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const database = require('../database/db');
const { reverseGeocode } = require('../bot/geocoder');
const { resolveSector } = require('../utils/sector-resolver');

const ALLOWED_MIME_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
  'video/webm': 'webm', 'video/3gpp': '3gp',
};

function saveBase64Media(base64Str) {
  try {
    if (!base64Str) return null;
    if (base64Str.startsWith('http') || base64Str.startsWith('/uploads/')) {
      return base64Str;
    }

    let mimeType = 'video/mp4';
    let base64Data = base64Str;

    if (base64Str.startsWith('data:')) {
      const matches = base64Str.match(/^data:([^;]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1].toLowerCase();
        base64Data = matches[2];
      }
    }

    const ext = ALLOWED_MIME_EXT[mimeType];
    if (!ext) return null; // rechaza tipos no permitidos

    const buffer = Buffer.from(base64Data, 'base64');
    const uniqueName = `media-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
    const uploadPath = path.join(__dirname, '../public/uploads');

    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

    fs.writeFileSync(path.join(uploadPath, uniqueName), buffer);
    return `/uploads/${uniqueName}`;
  } catch (err) {
    console.error('Error saving media to disk:', err.message);
    return null;
  }
}


const JWT_SECRET = process.env.JWT_SECRET;

router.post('/', async (req, res) => {
  if (req.tenantInfo?.suspended) {
    return res.status(403).json({ error: 'Servicio suspendido. Comuníquese con el administrador.', status: 'suspended' });
  }

  if (!req.models) {
    return res.status(503).json({ error: 'Tenant no resuelto. Verifique su sesión.' });
  }

  const Reporte = req.models.MensajeWhatsapp;
  const ConfiguracionModel = req.models.Configuracion;
  const GerenciaModel = req.models.Gerencia;

  const { mensaje, categoria, prioridad, sector, lat, lng, reportadoPor, ubicacion, estado, fotoUrl, videoUrl, tipoAgente } = req.body;

  if (!mensaje || !categoria || !lat || !lng) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (mensaje, categoria, lat, lng)' });
  }

  const id = 'MOB-' + String(Date.now()).slice(-6);
  const currentUser = req.user || null;
  const userGerencia = currentUser?.gerencia || null;

  // Resolver grupo y sub-área desde la BD del tenant (sin hardcoding, sin cruces entre orgs)
  let grupoPrincipal = userGerencia || 'municipal';
  let subAreaReal = null;

  if (userGerencia && GerenciaModel) {
    try {
      const gerDef = await GerenciaModel.findOne({ where: { clave: userGerencia } });
      if (gerDef?.esSubArea && gerDef.parentClave) {
        grupoPrincipal = gerDef.parentClave;
        subAreaReal = userGerencia;
      }
    } catch (e) {
      console.warn('No se pudo resolver gerencia padre:', e.message);
    }
  }

  let direccionReal = ubicacion;

  if (lat && lng) {
    // Timeout de 3 segundos para evitar que el reporte se quede "cargando" si el GPS es lento
    const direccionAuto = await Promise.race([
      reverseGeocode(parseFloat(lat), parseFloat(lng)),
      new Promise(resolve => setTimeout(() => resolve(null), 3000))
    ]);

    if (direccionAuto) {
      direccionReal = `${direccionAuto} (GPS)`;
    } else {
      direccionReal = `Reporte Móvil GPS (${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)})`;
    }
  }

  let mediaList = [];
  if (fotoUrl) {
    if (fotoUrl.startsWith('[')) {
      try { mediaList = mediaList.concat(JSON.parse(fotoUrl)); } catch (e) { mediaList.push(fotoUrl); }
    } else { mediaList.push(fotoUrl); }
  }
  if (videoUrl) {
    if (videoUrl.startsWith('[')) {
      try { mediaList = mediaList.concat(JSON.parse(videoUrl)); } catch (e) { mediaList.push(videoUrl); }
    } else { mediaList.push(videoUrl); }
  }

  // Convertir cualquier elemento base64 en archivo físico; filtrar rechazados (tipo no permitido)
  mediaList = mediaList.map(item => saveBase64Media(item)).filter(Boolean);

  const areasDerivadasGuardar = [grupoPrincipal];
  if (subAreaReal) {
    areasDerivadasGuardar.push(subAreaReal);
  } else if (userGerencia && userGerencia !== grupoPrincipal) {
    areasDerivadasGuardar.push(userGerencia);
  }

  const geocodedSector = resolveSector(lat, lng);
  let sectorFinal = geocodedSector || sector || 'Fuera de Jurisdicción';
  if (!sectorFinal || sectorFinal.toLowerCase() === 'sector central') {
    sectorFinal = 'Fuera de Jurisdicción';
  }


  const nuevoReporte = {
    idString: id,
    fecha: new Date(),
    grupo: grupoPrincipal,
    grupoWhatsapp: 'App Móvil',
    reportadoPor: currentUser ? currentUser.nombre : (reportadoPor || 'Usuario Móvil'),
    mensaje: tipoAgente ? `[MÓVIL] [${tipoAgente.toUpperCase()}] ${mensaje}` : `[MÓVIL] ${mensaje}`,
    categoria: categoria,
    prioridad: prioridad || 'Media',
    sector: sectorFinal,
    ubicacion: direccionReal,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    estado: estado || 'nuevo',
    fotoUrl: mediaList.length > 0 ? JSON.stringify(mediaList) : null,
    areasDerivadas: JSON.stringify(areasDerivadasGuardar),
    esDerivacionMultiple: false,
    supervisor: null  // se llenará abajo con el supervisor de turno
  };

  // === Buscar supervisor de turno automáticamente ===
  try {
    const hora = new Date().getHours();
    let claveTurno = 'supervisor_noche'; // 22:00 - 06:00
    if (hora >= 6 && hora < 14) claveTurno = 'supervisor_manana';
    else if (hora >= 14 && hora < 22) claveTurno = 'supervisor_tarde';

    const userGer = userGerencia || grupoPrincipal;
    if (ConfiguracionModel && userGer) {
      const habilitado = await ConfiguracionModel.findOne({ where: { clave: `habilitar_supervisores_${userGer}` } });
      const isHabilitado = habilitado ? (habilitado.valor === 'true') : (userGer === 'seguridad');

      if (isHabilitado) {
        const config = await ConfiguracionModel.findOne({ where: { clave: `${claveTurno}_${userGer}` } });
        if (config && config.valor) {
          nuevoReporte.supervisor = config.valor;
        }
      }
    }
  } catch (supErr) {
    console.warn('⚠️ No se pudo asignar supervisor de turno:', supErr.message);
  }


  try {
    const reporte = await Reporte.create(nuevoReporte);
    return res.status(201).json({ message: 'Reporte enviado con éxito', id: reporte.idString });
  } catch (err) {
    console.error('Error al guardar reporte móvil:', err.message);
    res.status(500).json({ error: 'Error al procesar el reporte' });
  }
});

// GET /api/reportes-movil/reverse-geocode — Geocodificación inversa para la app móvil
router.get('/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Faltan parámetros lat y lng' });
  }

  try {
    const direccion = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    if (direccion) {
      return res.json({ address: direccion });
    }
    return res.status(404).json({ error: 'Dirección no encontrada' });
  } catch (err) {
    console.error('Error en geocodificación inversa movil:', err.message);
    return res.status(500).json({ error: 'Error procesando geocodificación' });
  }
});

// POST /api/reportes-movil/ping — Heartbeat / Ping de actividad para mantener sesión online
router.post('/ping', (req, res) => {
  if (req.tenantInfo?.suspended) {
    return res.status(403).json({ error: 'Servicio suspendido.', status: 'suspended' });
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.username) {
        global.activeUsers = global.activeUsers || new Map();
        const activeKey = `${decoded.tenant || 'default'}:${decoded.username}`;
        global.activeUsers.set(activeKey, Date.now());
        return res.json({ status: 'ok', active: true });
      }
    } catch (e) {}
  }
  return res.json({ status: 'ok', active: false });
});

module.exports = router;
