/**
 * seed-demo.js
 * Carga datos ficticios de demostracion en la BD demo (Supabase o MySQL local).
 * Uso: node scripts/seed-demo.js
 *
 * IMPORTANTE: Solo usar contra BD demo. No correr en produccion.
 * Todos los datos son ficticios y claramente identificados como DEMO.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt    = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');

const dialect = process.env.DB_DIALECT || 'mysql';
const sequelize = new Sequelize(
  process.env.DB_UNIFIED_NAME,
  process.env.DB_UNIFIED_USER,
  process.env.DB_UNIFIED_PASS,
  {
    host: process.env.DB_UNIFIED_HOST || '127.0.0.1',
    port: process.env.DB_UNIFIED_PORT || (dialect === 'postgres' ? 5432 : 3306),
    dialect,
    dialectOptions: process.env.DB_SSL === 'true'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
    logging: false,
  }
);

const isPg = dialect === 'postgres';
// MySQL: INSERT IGNORE  /  PostgreSQL: INSERT ... ON CONFLICT DO NOTHING
const onConflict = isPg ? 'ON CONFLICT DO NOTHING' : 'IGNORE';
const insertIgnore = (table, cols, vals) => isPg
  ? `INSERT INTO "${table}" (${cols}) VALUES ${vals} ON CONFLICT DO NOTHING`
  : `INSERT IGNORE INTO ${table} (${cols}) VALUES ${vals}`;

const DEMO_ORG = 'demo';
const NOW = new Date();
const daysAgo = (n) => new Date(NOW - n * 86400000);
const ts = (d) => `'${d.toISOString().slice(0,19).replace('T',' ')}'`;

async function run() {
  await sequelize.authenticate();
  console.log('Conectado a BD demo.');

  // Limpiar datos demo anteriores para poder correr seed varias veces
  await sequelize.query(`DELETE FROM ${isPg ? '"Obras"' : 'Obras'} WHERE "organizationId" = '${DEMO_ORG}'`).catch(() => {});
  await sequelize.query(`DELETE FROM ${isPg ? '"Licencias"' : 'Licencias'} WHERE "organizationId" = '${DEMO_ORG}'`).catch(() => {});
  await sequelize.query(`DELETE FROM ${isPg ? '"Incidencias"' : 'Incidencias'} WHERE "organizationId" = '${DEMO_ORG}'`).catch(() => {});
  await sequelize.query(`DELETE FROM ${isPg ? '"MensajeWhatsapps"' : 'MensajeWhatsapps'} WHERE "organizationId" = '${DEMO_ORG}'`).catch(() => {});
  await sequelize.query(`DELETE FROM ${isPg ? '"Configuraciones"' : 'Configuraciones'} WHERE "organizationId" = '${DEMO_ORG}'`).catch(() => {});
  await sequelize.query(`DELETE FROM ${isPg ? '"GrupoVinculados"' : 'GrupoVinculados'} WHERE "organizationId" = '${DEMO_ORG}'`).catch(() => {});
  await sequelize.query(`DELETE FROM ${isPg ? '"Gerencias"' : 'Gerencias'} WHERE "organizationId" = '${DEMO_ORG}'`).catch(() => {});
  await sequelize.query(`DELETE FROM ${isPg ? '"Usuarios"' : 'Usuarios'} WHERE "organizationId" = '${DEMO_ORG}'`).catch(() => {});

  // ── 1. Organizacion demo ──────────────────────────────────────────────────
  await sequelize.query(
    insertIgnore('Organizaciones',
      '"id", "nombre", "subdominio", "plan", "estado", "nombreProvincia", "primaryColor", "createdAt", "updatedAt"',
      `('${DEMO_ORG}', 'Municipalidad Demo', '${DEMO_ORG}', 'PRO', 'activo', 'Provincia Demo', '#1a6b3a', NOW(), NOW())`
    )
  );
  console.log('Organizacion creada: demo');

  // ── 2. SuperAdmin ─────────────────────────────────────────────────────────
  const hashSA = await bcrypt.hash('superadmin_demo', 10);
  await sequelize.query(
    insertIgnore('SuperAdmins',
      '"username", "password", "nombre", "createdAt", "updatedAt"',
      `('superadmin', '${hashSA}', 'Super Administrador DEMO', NOW(), NOW())`
    )
  );
  console.log('SuperAdmin creado: superadmin / superadmin_demo');

  // ── 3. Usuarios ───────────────────────────────────────────────────────────
  const hashAdmin    = await bcrypt.hash('admin_demo', 10);
  const hashGerente  = await bcrypt.hash('gerente_demo', 10);
  const hashOperador = await bcrypt.hash('operador_demo', 10);

  const usuariosCols = '"organizationId", "username", "password", "nombre", "rol", "gerencia", "habilitado", "createdAt", "updatedAt"';
  await sequelize.query(`INSERT INTO ${isPg ? '"Usuarios"' : 'Usuarios'} (${usuariosCols}) VALUES
    ('${DEMO_ORG}', 'admin',     '${hashAdmin}',    'Admin Demo',        'admin',    'all',       true, NOW(), NOW()),
    ('${DEMO_ORG}', 'gerente1',  '${hashGerente}',  'Gerente Seguridad', 'gerente',  'seguridad', true, NOW(), NOW()),
    ('${DEMO_ORG}', 'operador1', '${hashOperador}', 'Operador Demo',     'operador', 'seguridad', true, NOW(), NOW())`
  );
  console.log('Usuarios creados: admin/admin_demo · gerente1/gerente_demo · operador1/operador_demo');

  // ── 4. Gerencias ──────────────────────────────────────────────────────────
  const gerenciasCols = '"organizationId", "clave", "nombre", "icono", "color", "esSubArea", "parentClave", "orden", "createdAt", "updatedAt"';
  await sequelize.query(`INSERT INTO ${isPg ? '"Gerencias"' : 'Gerencias'} (${gerenciasCols}) VALUES
    ('${DEMO_ORG}', 'seguridad',     'Seguridad Ciudadana', 'S', '#3b82f6', false, NULL,         1, NOW(), NOW()),
    ('${DEMO_ORG}', 'fiscalizacion', 'Fiscalizacion',       'F', '#f59e0b', true,  'seguridad',  2, NOW(), NOW()),
    ('${DEMO_ORG}', 'limpieza',      'Limpieza Publica',    'L', '#10b981', false, NULL,         3, NOW(), NOW()),
    ('${DEMO_ORG}', 'transito',      'Transito',            'T', '#ef4444', false, NULL,         4, NOW(), NOW())`
  );
  console.log('Gerencias creadas: seguridad, fiscalizacion, limpieza, transito');

  // ── 5. Grupos vinculados ──────────────────────────────────────────────────
  const grupoCols = '"organizationId", "remoteId", "nombre", "areaId", "monitoreado", "createdAt", "updatedAt"';
  await sequelize.query(`INSERT INTO ${isPg ? '"GrupoVinculados"' : 'GrupoVinculados'} (${grupoCols}) VALUES
    ('${DEMO_ORG}', 'DEMO-GRP-001', 'Grupo Seguridad DEMO', 'seguridad', true, NOW(), NOW()),
    ('${DEMO_ORG}', 'DEMO-GRP-002', 'Grupo Limpieza DEMO',  'limpieza',  true, NOW(), NOW()),
    ('${DEMO_ORG}', 'DEMO-GRP-003', 'Grupo Transito DEMO',  'transito',  true, NOW(), NOW())`
  );

  // ── 6. Configuraciones ────────────────────────────────────────────────────
  const confCols = '"organizationId", "clave", "valor", "createdAt", "updatedAt"';
  await sequelize.query(`INSERT INTO ${isPg ? '"Configuraciones"' : 'Configuraciones'} (${confCols}) VALUES
    ('${DEMO_ORG}', 'timezone',     'America/Lima', NOW(), NOW()),
    ('${DEMO_ORG}', 'nombre_corto', 'Muni Demo',    NOW(), NOW()),
    ('${DEMO_ORG}', 'lat_centro',   '-12.046374',   NOW(), NOW()),
    ('${DEMO_ORG}', 'lng_centro',   '-77.042793',   NOW(), NOW())`
  );

  // ── 7. Reportes ficticios ─────────────────────────────────────────────────
  const reportes = [
    { id: 'DEMO-001', grupo: 'seguridad',     cat: 'robo',          prio: 'alta',  sector: 'S1', dir: 'Av. Principal 100',  lat: -12.046, lng: -77.042, estado: 'nuevo',      dias: 0 },
    { id: 'DEMO-002', grupo: 'seguridad',     cat: 'disturbio',     prio: 'media', sector: 'S2', dir: 'Jr. Las Flores 200', lat: -12.047, lng: -77.043, estado: 'en_proceso', dias: 1 },
    { id: 'DEMO-003', grupo: 'limpieza',      cat: 'basura',        prio: 'baja',  sector: 'S1', dir: 'Calle Los Pinos 50', lat: -12.048, lng: -77.044, estado: 'atendida',   dias: 2 },
    { id: 'DEMO-004', grupo: 'transito',      cat: 'accidente',     prio: 'alta',  sector: 'S3', dir: 'Av. Republica 300', lat: -12.049, lng: -77.045, estado: 'nuevo',      dias: 0 },
    { id: 'DEMO-005', grupo: 'fiscalizacion', cat: 'local_sin_lic', prio: 'media', sector: 'S2', dir: 'Jr. Comercio 450',  lat: -12.050, lng: -77.046, estado: 'pendiente',  dias: 3 },
    { id: 'DEMO-006', grupo: 'seguridad',     cat: 'vandalismo',    prio: 'media', sector: 'S4', dir: 'Av. Los Parques 80',lat: -12.051, lng: -77.047, estado: 'nuevo',      dias: 1 },
    { id: 'DEMO-007', grupo: 'limpieza',      cat: 'desmonte',      prio: 'baja',  sector: 'S1', dir: 'Calle Union 25',    lat: -12.052, lng: -77.048, estado: 'en_proceso', dias: 4 },
    { id: 'DEMO-008', grupo: 'transito',      cat: 'semaforo',      prio: 'alta',  sector: 'S3', dir: 'Interseccion Lima', lat: -12.053, lng: -77.049, estado: 'atendida',   dias: 5 },
    { id: 'DEMO-009', grupo: 'seguridad',     cat: 'ruido',         prio: 'baja',  sector: 'S2', dir: 'Jr. Bello 120',    lat: -12.054, lng: -77.050, estado: 'nuevo',      dias: 0 },
    { id: 'DEMO-010', grupo: 'fiscalizacion', cat: 'publicidad',    prio: 'baja',  sector: 'S4', dir: 'Av. Central 600',  lat: -12.055, lng: -77.051, estado: 'pendiente',  dias: 2 },
  ];

  const repCols = '"idString", "organizationId", "fecha", "grupo", "grupoWhatsapp", "reportadoPor", "telefono", "mensaje", "categoria", "prioridad", "sector", "ubicacion", "direccionExtraida", "lat", "lng", "estado", "areasDerivadas", "esDerivacionMultiple", "createdAt", "updatedAt"';
  for (const r of reportes) {
    const fecha = ts(daysAgo(r.dias));
    await sequelize.query(`INSERT INTO ${isPg ? '"MensajeWhatsapps"' : 'MensajeWhatsapps'} (${repCols}) VALUES (
      '${r.id}', '${DEMO_ORG}', ${fecha},
      '${r.grupo}', 'Grupo ${r.grupo} DEMO', 'Ciudadano Demo', '999000000',
      '[DEMO] Reporte ficticio: ${r.cat} en ${r.dir}',
      '${r.cat}', '${r.prio}', '${r.sector}', '${r.dir}', '${r.dir}',
      ${r.lat}, ${r.lng}, '${r.estado}',
      '["${r.grupo}"]', false, NOW(), NOW()
    )`);
  }
  console.log(`${reportes.length} reportes ficticios creados.`);

  // ── 8. Incidencias ────────────────────────────────────────────────────────
  const incCols = '"organizationId", "tipo", "descripcion", "sector", "direccion", "lat", "lng", "prioridad", "estado", "fuente", "createdAt", "updatedAt"';
  await sequelize.query(`INSERT INTO ${isPg ? '"Incidencias"' : 'Incidencias'} (${incCols}) VALUES
    ('${DEMO_ORG}', 'Robo al paso',    '[DEMO] Incidencia ficticia', 'S1', 'Av. Principal 100',  -12.046, -77.042, 'alta', 'pendiente',  'demo', NOW(), NOW()),
    ('${DEMO_ORG}', 'Desmonte urbano', '[DEMO] Incidencia ficticia', 'S1', 'Jr. Las Flores 200', -12.047, -77.043, 'baja', 'en_proceso', 'demo', NOW(), NOW()),
    ('${DEMO_ORG}', 'Accidente vial',  '[DEMO] Incidencia ficticia', 'S1', 'Av. Republica 300',  -12.049, -77.045, 'alta', 'atendida',   'demo', NOW(), NOW())`
  );
  console.log('3 incidencias ficticias creadas.');

  // ── 9. Licencias ──────────────────────────────────────────────────────────
  const licCols = '"organizationId", "negocio", "ruc", "rubro", "direccion", "sector", "fecha_emision", "fecha_vencimiento", "estado", "tiene_itsdc", "createdAt", "updatedAt"';
  await sequelize.query(`INSERT INTO ${isPg ? '"Licencias"' : 'Licencias'} (${licCols}) VALUES
    ('${DEMO_ORG}', 'Bodega El Demo',      '20000000001', 'Comercio minorista', 'Jr. Prueba 100',  'S1', '2025-01-01', '2026-12-31', 'activa',  true,  NOW(), NOW()),
    ('${DEMO_ORG}', 'Restaurant Ficticio', '20000000002', 'Alimentos',          'Av. Demo 200',    'S2', '2024-06-01', '2025-05-31', 'vencida', false, NOW(), NOW()),
    ('${DEMO_ORG}', 'Farmacia Demo',       '20000000003', 'Salud',              'Calle Test 300',  'S3', '2025-03-01', '2027-02-28', 'activa',  true,  NOW(), NOW())`
  );
  console.log('3 licencias ficticias creadas.');

  // ── 10. Obras ─────────────────────────────────────────────────────────────
  const obraCols = '"organizationId", "nombre", "ubicacion", "avance", "plazo", "estado", "presupuesto", "createdAt", "updatedAt"';
  await sequelize.query(`INSERT INTO ${isPg ? '"Obras"' : 'Obras'} (${obraCols}) VALUES
    ('${DEMO_ORG}', 'Parchado de pistas Demo',    'Av. Principal tramo 1-3', 65, '2026-12-31', 'en_plazo',  150000.00, NOW(), NOW()),
    ('${DEMO_ORG}', 'Pintura de sardineles',       'Jr. Las Flores completo', 30, '2026-09-30', 'retraso',    45000.00, NOW(), NOW()),
    ('${DEMO_ORG}', 'Instalacion de luminarias',   'Parque Central Demo',     90, '2026-07-31', 'culminada',  80000.00, NOW(), NOW())`
  );
  console.log('3 obras ficticias creadas.');

  console.log('\n============================================================');
  console.log('SEED DEMO completado. Cuentas disponibles:');
  console.log('  SuperAdmin:  superadmin  /  superadmin_demo');
  console.log('  Admin demo:  admin       /  admin_demo');
  console.log('  Gerente:     gerente1    /  gerente_demo');
  console.log('  Operador:    operador1   /  operador_demo');
  console.log('  Tenant:      demo');
  console.log('============================================================');

  await sequelize.close();
}

run().catch(err => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
