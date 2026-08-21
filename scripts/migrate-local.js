/**
 * migrate-local.js
 * Crea todas las tablas en la base de datos local (MySQL).
 * Uso: node scripts/migrate-local.js
 *
 * Requiere .env configurado con DB_UNIFIED_* apuntando a tu MySQL local.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_UNIFIED_NAME,
  process.env.DB_UNIFIED_USER,
  process.env.DB_UNIFIED_PASS,
  {
    host: process.env.DB_UNIFIED_HOST || '127.0.0.1',
    port: process.env.DB_UNIFIED_PORT || 3306,
    dialect: 'mysql',
    logging: (msg) => console.log('  SQL:', msg.substring(0, 120)),
  }
);

// ── Modelos (espejo de database/unified.js) ──────────────────────────────────

sequelize.define('Organizacion', {
  id:             { type: DataTypes.STRING(50), primaryKey: true },
  nombre:         { type: DataTypes.STRING(100), allowNull: false },
  subdominio:     { type: DataTypes.STRING(50), allowNull: false, unique: true },
  plan:           { type: DataTypes.STRING(20), defaultValue: 'BASIC' },
  estado:         { type: DataTypes.STRING(20), defaultValue: 'activo' },
  logoUrl:        { type: DataTypes.STRING(255) },
  nombreProvincia:{ type: DataTypes.STRING(100) },
  primaryColor:   { type: DataTypes.STRING(30), defaultValue: '#1a6b3a' },
}, { tableName: 'Organizaciones', timestamps: true });

sequelize.define('SuperAdmin', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  nombre:   { type: DataTypes.STRING(100) },
}, { tableName: 'SuperAdmins', timestamps: true });

sequelize.define('Usuario', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  username:       { type: DataTypes.STRING(255), allowNull: false },
  password:       { type: DataTypes.STRING(255), allowNull: false },
  nombre:         { type: DataTypes.STRING(255), allowNull: false },
  rol:            { type: DataTypes.ENUM('admin','gerente','operador','visor','supervisor'), defaultValue: 'visor' },
  gerencia:       { type: DataTypes.STRING(255), defaultValue: 'all' },
  supervisor:     { type: DataTypes.STRING(100) },
  habilitado:     { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'Usuarios', timestamps: true });

sequelize.define('MensajeWhatsapp', {
  idString:             { type: DataTypes.STRING(50), primaryKey: true },
  organizationId:       { type: DataTypes.STRING(50), allowNull: false },
  fecha:                { type: DataTypes.DATE },
  grupo:                { type: DataTypes.STRING(50) },
  grupoWhatsapp:        { type: DataTypes.STRING(100) },
  reportadoPor:         { type: DataTypes.STRING(100) },
  telefono:             { type: DataTypes.STRING(20) },
  mensaje:              { type: DataTypes.TEXT },
  categoria:            { type: DataTypes.STRING(50) },
  prioridad:            { type: DataTypes.STRING(20) },
  sector:               { type: DataTypes.STRING(50) },
  ubicacion:            { type: DataTypes.STRING(200) },
  direccionExtraida:    { type: DataTypes.STRING(200) },
  lat:                  { type: DataTypes.DECIMAL(10, 6) },
  lng:                  { type: DataTypes.DECIMAL(10, 6) },
  estado:               { type: DataTypes.STRING(20), defaultValue: 'nuevo' },
  asignadoA:            { type: DataTypes.STRING(100) },
  notas:                { type: DataTypes.TEXT },
  fotoUrl:              { type: DataTypes.TEXT('long') },
  areasDerivadas:       { type: DataTypes.TEXT },
  esDerivacionMultiple: { type: DataTypes.BOOLEAN, defaultValue: false },
  supervisor:           { type: DataTypes.STRING(100) },
}, { tableName: 'MensajeWhatsapps', timestamps: true });

sequelize.define('SesionUsuario', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  usuarioId:      { type: DataTypes.INTEGER },
  username:       { type: DataTypes.STRING(50) },
  nombre:         { type: DataTypes.STRING(100) },
  gerencia:       { type: DataTypes.STRING(50) },
  inicioSesion:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  finSesion:      { type: DataTypes.DATE },
}, { tableName: 'SesionUsuarios', timestamps: true });

sequelize.define('Incidencia', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  tipo:           { type: DataTypes.STRING(50), allowNull: false },
  descripcion:    { type: DataTypes.TEXT },
  sector:         { type: DataTypes.STRING(20) },
  direccion:      { type: DataTypes.STRING(200) },
  lat:            { type: DataTypes.DECIMAL(10, 6) },
  lng:            { type: DataTypes.DECIMAL(10, 6) },
  prioridad:      { type: DataTypes.ENUM('alta','media','baja'), defaultValue: 'media' },
  estado:         { type: DataTypes.ENUM('pendiente','en_proceso','atendida','cerrada'), defaultValue: 'pendiente' },
  fuente:         { type: DataTypes.STRING(50) },
  reportadorId:   { type: DataTypes.INTEGER },
}, { tableName: 'Incidencias', timestamps: true });

sequelize.define('Licencia', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId:   { type: DataTypes.STRING(50), allowNull: false },
  negocio:          { type: DataTypes.STRING(100), allowNull: false },
  ruc:              { type: DataTypes.STRING(11) },
  rubro:            { type: DataTypes.STRING(50) },
  direccion:        { type: DataTypes.STRING(200) },
  sector:           { type: DataTypes.STRING(20) },
  fecha_emision:    { type: DataTypes.DATE },
  fecha_vencimiento:{ type: DataTypes.DATE },
  estado:           { type: DataTypes.ENUM('activa','vencida','suspendida','revocada'), defaultValue: 'activa' },
  tiene_itsdc:      { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'Licencias', timestamps: true });

sequelize.define('Inspeccion', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  negocio:        { type: DataTypes.STRING(100) },
  direccion:      { type: DataTypes.STRING(200) },
  inspector:      { type: DataTypes.STRING(100) },
  fecha:          { type: DataTypes.DATE },
  resultado:      { type: DataTypes.ENUM('aprobado','observado','rechazado') },
  observaciones:  { type: DataTypes.TEXT },
}, { tableName: 'Inspecciones', timestamps: true });

sequelize.define('Obra', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  nombre:         { type: DataTypes.STRING(100) },
  ubicacion:      { type: DataTypes.STRING(200) },
  avance:         { type: DataTypes.INTEGER, defaultValue: 0 },
  plazo:          { type: DataTypes.DATE },
  estado:         { type: DataTypes.ENUM('por_iniciar','en_plazo','retraso','culminada') },
  presupuesto:    { type: DataTypes.DECIMAL(12, 2) },
}, { tableName: 'Obras', timestamps: true });

sequelize.define('Gerencia', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  clave:          { type: DataTypes.STRING(50), allowNull: false },
  nombre:         { type: DataTypes.STRING(100), allowNull: false },
  icono:          { type: DataTypes.STRING(20), defaultValue: '?' },
  color:          { type: DataTypes.STRING(20), defaultValue: '#3b82f6' },
  esSubArea:      { type: DataTypes.BOOLEAN, defaultValue: false },
  parentClave:    { type: DataTypes.STRING(50) },
  orden:          { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'Gerencias', timestamps: true });

sequelize.define('GrupoVinculado', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  remoteId:       { type: DataTypes.STRING(100) },
  nombre:         { type: DataTypes.STRING(100) },
  areaId:         { type: DataTypes.STRING(50) },
  monitoreado:    { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'GrupoVinculados', timestamps: true });

sequelize.define('Configuracion', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  clave:          { type: DataTypes.STRING(100), allowNull: false },
  valor:          { type: DataTypes.STRING(255) },
  gerencia:       { type: DataTypes.STRING(50) },
}, { tableName: 'Configuraciones', timestamps: true });

// ── Ejecución ─────────────────────────────────────────────────────────────────

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Conexion a BD local OK');
    await sequelize.sync({ force: false, alter: false });
    console.log('Tablas creadas/verificadas correctamente.');
    console.log('Siguiente paso: node scripts/seed-demo.js');
  } catch (err) {
    console.error('Error en migracion:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
