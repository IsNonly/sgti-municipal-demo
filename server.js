require('dotenv').config({ path: require('path').join(__dirname, '.env') });

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no está definido en .env — el servidor no puede arrancar de forma segura.');
  process.exit(1);
}

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const helmet  = require('helmet');
const database = require('./database/db');

const app  = express();
const PORT = process.env.PORT || 3001;

// Confiar en el proxy de nginx para X-Forwarded-For (necesario para express-rate-limit)
app.set('trust proxy', 1);

// Desactivar ETags para rutas de API — evita que el navegador cachee respuestas dinámicas (304 falsos)
app.set('etag', false);
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ===== MIDDLEWARE =====
// Helmet sin CSP (el frontend usa scripts inline; CSP requiere auditoría aparte)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = /^https?:\/\/(localhost|127\.0\.0\.1|.*\.gobernanzamunicipal\.com)(:\d+)?$/;
    if (allowed.test(origin) || origin === 'capacitor://localhost') return cb(null, true);
    cb(new Error('CORS no permitido'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

// Multer guarda en memoria para procesar con sharp antes de escribir a disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB máximo de entrada
});

// Ruta para subir fotos — requiere sesión activa del brigadista
app.post('/api/upload', (req, res, next) => require('./middleware/auth').authMiddleware(req, res, next), upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });

  try {
    const uploadPath = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `media-${uniqueSuffix}.jpg`;
    const destPath = path.join(uploadPath, filename);

    // Comprimir y redimensionar: máx 1280px, calidad 75%, siempre JPEG
    await sharp(req.file.buffer)
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .toFile(destPath);

    res.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error('Error procesando imagen:', err.message);
    res.status(500).json({ error: 'Error procesando la imagen' });
  }
});


// ===== RUTAS PROTEGIDAS =====
const { authMiddleware } = require('./middleware/auth');
const tenantConnection = require('./middlewares/tenantConnection');

// Rutas de SuperAdmin van ANTES del tenantConnection (no necesitan resolución de tenant)
app.use('/api/superadmin', require('./routes/superadmin'));

// tenantConnection va ANTES que auth y todas las demás rutas de /api
// para que req.models esté disponible en el login (corrección de cruce de BDs)
app.use('/api', tenantConnection);

// ===== RUTAS PÚBLICAS (después de tenantConnection para usar req.models correcto) =====
app.use('/api/auth', require('./routes/auth'));

// Endpoint público para obtener la información del Tenant actual (logo, nombreDistrito, etc.)
app.get('/api/tenant/info', (req, res) => {
  if (req.tenantInfo) {
    res.json(req.tenantInfo);
  } else {
    res.status(503).json({ error: 'Municipalidad no identificada. Verifique la URL.' });
  }
});

// Vista pública de evidencia fotográfica — tenant-scoped (solo ve fotos de su propio municipio)
app.get('/api/reporte/foto/:id', async (req, res) => {
  const safeId = String(req.params.id).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  try {
    const MensajeWhatsapp = req.models?.MensajeWhatsapp;
    if (!MensajeWhatsapp) return res.status(503).send('<h2 style="text-align:center;font-family:sans-serif;margin-top:20%;color:#333;">Municipalidad no identificada.</h2>');
    const msg = await MensajeWhatsapp.findOne({ where: { idString: req.params.id } });
    if (!msg || !msg.fotoUrl || msg.fotoUrl.length < 10) {
      return res.status(404).send('<h2 style="text-align:center;font-family:sans-serif;margin-top:20%;color:#333;">No hay evidencia fotográfica para este reporte.</h2>');
    }
    let fotosArr = [];
    if (msg.fotoUrl.startsWith('[')) {
      try { fotosArr = JSON.parse(msg.fotoUrl); } catch (e) { fotosArr = [msg.fotoUrl]; }
    } else { fotosArr = [msg.fotoUrl]; }
    const cleanedFotos = fotosArr.map(f => {
      if (!f) return '';
      if (f.startsWith('http') || f.startsWith('data:') || f.startsWith('/uploads')) return f;
      return 'data:image/jpeg;base64,' + f;
    }).filter(f => f);
    const imgTags = cleanedFotos.map(f => `<img src="${f}" alt="Evidencia">`).join('\n');
    const html = `<!DOCTYPE html><html><head><title>Evidencia Reporte ${safeId}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#0a0a0a;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;padding:20px;box-sizing:border-box}.gallery{display:flex;flex-wrap:wrap;gap:20px;justify-content:center;max-width:1200px;margin-top:60px}img{max-width:90vw;max-height:80vh;object-fit:contain;box-shadow:0 10px 30px rgba(0,0,0,0.5);border-radius:8px}@media(min-width:768px){img{max-width:45%}}.back-btn{position:fixed;top:20px;left:20px;background:rgba(255,255,255,0.1);color:white;text-decoration:none;padding:10px 20px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);backdrop-filter:blur(5px);z-index:10}.back-btn:hover{background:rgba(255,255,255,0.2)}</style></head><body><a href="javascript:window.close()" class="back-btn">Cerrar Pestaña</a><div class="gallery">${imgTags}</div></body></html>`;
    res.send(html);
  } catch (err) {
    console.error('Error cargando foto:', err);
    res.status(500).send('Error interno cargando la imagen.');
  }
});

app.use('/api/overview', authMiddleware, require('./routes/overview'));
app.use('/api/seguridad', authMiddleware, require('./routes/seguridad'));
app.use('/api/whatsapp', authMiddleware, require('./routes/reportes'));
app.use('/api/mapa', authMiddleware, require('./routes/mapa'));
app.use('/api/equipo', authMiddleware, require('./routes/equipo'));
app.use('/api/reportes-movil', authMiddleware, require('./routes/reportes-movil'));


app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ===== ESTÁTICOS FRONTEND (PRODUCCIÓN) =====
// Este bloque servirá tu app Vite ya compilada cuando esté en Hostinger
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const tenantConnection = require('./middlewares/tenantConnection');
  tenantConnection(req, res, () => res.sendFile(path.join(__dirname, 'public/index.html')));
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ===== START =====
async function start() {
  await database.connect();

  try {
    await runSectorMigration();
  } catch (errMig) {
    console.warn('⚠️ [Migration] Ignorada por falta de conexión local inicial.');
  }

  app.listen(PORT, () => {
    console.log('');
    console.log(`[SGTI Municipal] API corriendo en puerto ${PORT} — multi-tenant`);
  });
}

async function runSectorMigration() {
  try {
    const { Organizacion, getScopedModels } = require('./database/unified');
    const { resolveSector } = require('./utils/sector-resolver');

    const orgs = await Organizacion.findAll({ where: { estado: 'activo' } });
    let totalActualizados = 0;

    for (const org of orgs) {
      const { MensajeWhatsapp } = getScopedModels(org.id);
      const reportes = await MensajeWhatsapp.findAll({
        where: { sector: [null, '', 'Sector Central', 'sector central'] }
      });
      for (const r of reportes) {
        r.sector = (r.lat && r.lng && resolveSector(r.lat, r.lng)) || 'Fuera de Jurisdicción';
        await r.save();
        totalActualizados++;
      }
    }

    if (totalActualizados > 0) {
      console.log(`[Migración] Se actualizaron ${totalActualizados} reportes sin sector.`);
    }
  } catch (err) {
    console.warn('[Migración] Error:', err.message);
  }
}

start();
