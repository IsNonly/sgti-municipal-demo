const { Sequelize, DataTypes } = require('sequelize');

const dialect = process.env.DB_DIALECT || 'mysql';
const sequelize = new Sequelize(
  process.env.DB_UNIFIED_NAME,
  process.env.DB_UNIFIED_USER,
  process.env.DB_UNIFIED_PASS,
  {
    host: process.env.DB_UNIFIED_HOST,
    port: process.env.DB_UNIFIED_PORT || (dialect === 'postgres' ? 5432 : 3306),
    dialect,
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: process.env.DB_SSL === 'true'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  }
);

const Organizacion = sequelize.define('Organizacion', {
  id:           { type: DataTypes.STRING(50), primaryKey: true },
  nombre:       { type: DataTypes.STRING(100), allowNull: false },
  subdominio:   { type: DataTypes.STRING(50), allowNull: false, unique: true },
  plan:         { type: DataTypes.STRING(20), defaultValue: 'BASIC' },
  estado:       { type: DataTypes.STRING(20), defaultValue: 'activo' },
  logoUrl:        { type: DataTypes.STRING(255) },
  nombreProvincia:{ type: DataTypes.STRING(100) },
  primaryColor:   { type: DataTypes.STRING(30), defaultValue: '#1a6b3a' },
}, { tableName: 'Organizaciones', timestamps: true });

const SuperAdmin = sequelize.define('SuperAdmin', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  nombre:   { type: DataTypes.STRING(100) },
}, { tableName: 'SuperAdmins', timestamps: true });

// Modelos con organizationId — definidos una sola vez sobre la conexión unificada
const Usuario = sequelize.define('Usuario', {
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

const MensajeWhatsapp = sequelize.define('MensajeWhatsapp', {
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

const SesionUsuario = sequelize.define('SesionUsuario', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  usuarioId:      { type: DataTypes.INTEGER },
  username:       { type: DataTypes.STRING(50) },
  nombre:         { type: DataTypes.STRING(100) },
  gerencia:       { type: DataTypes.STRING(50) },
  inicioSesion:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  finSesion:      { type: DataTypes.DATE },
}, { tableName: 'SesionUsuarios', timestamps: true });

const Incidencia = sequelize.define('Incidencia', {
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

const Licencia = sequelize.define('Licencia', {
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

const Inspeccion = sequelize.define('Inspeccion', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  negocio:        { type: DataTypes.STRING(100) },
  direccion:      { type: DataTypes.STRING(200) },
  inspector:      { type: DataTypes.STRING(100) },
  fecha:          { type: DataTypes.DATE },
  resultado:      { type: DataTypes.ENUM('aprobado','observado','rechazado') },
  observaciones:  { type: DataTypes.TEXT },
}, { tableName: 'Inspecciones', timestamps: true });

const Obra = sequelize.define('Obra', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  nombre:         { type: DataTypes.STRING(100) },
  ubicacion:      { type: DataTypes.STRING(200) },
  avance:         { type: DataTypes.INTEGER, defaultValue: 0 },
  plazo:          { type: DataTypes.DATE },
  estado:         { type: DataTypes.ENUM('por_iniciar','en_plazo','retraso','culminada') },
  presupuesto:    { type: DataTypes.DECIMAL(12, 2) },
}, { tableName: 'Obras', timestamps: true });

const Gerencia = sequelize.define('Gerencia', {
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

const GrupoVinculado = sequelize.define('GrupoVinculado', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  remoteId:       { type: DataTypes.STRING(100) },
  nombre:         { type: DataTypes.STRING(100) },
  areaId:         { type: DataTypes.STRING(50) },
  monitoreado:    { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'GrupoVinculados', timestamps: true });

const Configuracion = sequelize.define('Configuracion', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  organizationId: { type: DataTypes.STRING(50), allowNull: false },
  clave:          { type: DataTypes.STRING(100), allowNull: false },
  valor:          { type: DataTypes.STRING(255) },
  gerencia:       { type: DataTypes.STRING(50) },
}, { tableName: 'Configuraciones', timestamps: true });

const ALL_MODELS = {
  Usuario, MensajeWhatsapp, SesionUsuario, Incidencia,
  Licencia, Inspeccion, Obra, Gerencia, GrupoVinculado, Configuracion
};

// Devuelve proxies de cada modelo con organizationId inyectado automáticamente
function getScopedModels(organizationId) {
  const scoped = {};
  for (const [name, Model] of Object.entries(ALL_MODELS)) {
    scoped[name] = scopeModel(Model, organizationId);
  }
  return scoped;
}

function mergeWhere(opts, organizationId) {
  const o = opts ? { ...opts } : {};
  o.where = { ...(o.where || {}), organizationId };
  return o;
}

function scopeModel(Model, organizationId) {
  return {
    findAll:         (opts)       => Model.findAll(mergeWhere(opts, organizationId)),
    findOne:         (opts)       => Model.findOne(mergeWhere(opts, organizationId)),
    findAndCountAll: (opts)       => Model.findAndCountAll(mergeWhere(opts, organizationId)),
    count:           (opts)       => Model.count(mergeWhere(opts, organizationId)),
    findByPk:        (id, opts)   => Model.findOne({ ...mergeWhere(opts, organizationId), where: { id, organizationId } }),
    create:          (data, opts) => Model.create({ ...data, organizationId }, opts),
    bulkCreate:      (rows, opts) => Model.bulkCreate(rows.map(r => ({ ...r, organizationId })), opts),
    update:          (data, opts) => Model.update(data, mergeWhere(opts, organizationId)),
    destroy:         (opts)       => Model.destroy(mergeWhere(opts, organizationId)),
    upsert:          (data, opts) => Model.upsert({ ...data, organizationId }, opts),
    // Acceso al modelo raw para casos especiales (sequelize.query, etc.)
    _raw: Model,
    _organizationId: organizationId,
  };
}

module.exports = { sequelize, Organizacion, SuperAdmin, getScopedModels, ALL_MODELS };
