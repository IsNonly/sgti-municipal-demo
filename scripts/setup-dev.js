/**
 * setup-dev.js — Prepara el entorno local de SGTI Municipal
 *
 * Crea todas las tablas (si no existen) y siembra datos ficticios.
 * Seguro para re-ejecutar: no borra datos existentes.
 *
 * Uso:
 *   node scripts/setup-dev.js
 *
 * Requisitos previos:
 *   - MySQL corriendo localmente
 *   - Base de datos `sgti_local` creada (CREATE DATABASE sgti_local CHARACTER SET utf8mb4)
 *   - .env configurado con las variables de base de datos
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Organizacion, SuperAdmin, ALL_MODELS } = require('../database/unified');

// ── Datos ficticios ───────────────────────────────────────────────────────────

const ORG_ID   = 'demo';
const ORG_DEMO = {
  id:           ORG_ID,
  nombre:       'Municipalidad Demo',
  subdominio:   'demo',
  plan:         'PRO',
  estado:       'activo',
  primaryColor: '#1a6b3a',
  nombreProvincia: 'Lima',
};

const GERENCIAS_DEMO = [
  { clave: 'seguridad',      nombre: 'Seguridad Ciudadana', icono: '🛡️', color: '#3b82f6', esSubArea: false, parentClave: null, orden: 1 },
  { clave: 'fiscalizacion',  nombre: 'Fiscalización',       icono: '📋', color: '#8b5cf6', esSubArea: true,  parentClave: 'seguridad', orden: 2 },
  { clave: 'ambiental',      nombre: 'Medio Ambiente',      icono: '🌿', color: '#10b981', esSubArea: false, parentClave: null, orden: 3 },
  { clave: 'urbano',         nombre: 'Desarrollo Urbano',   icono: '🏗️', color: '#f59e0b', esSubArea: false, parentClave: null, orden: 4 },
];

const USUARIOS_DEMO = [
  { username: 'admin',      password: 'Admin2024!',    nombre: 'Administrador Demo',    rol: 'admin',    gerencia: 'all' },
  { username: 'gerente1',   password: 'Gerente2024!',  nombre: 'Carlos Quispe',         rol: 'gerente',  gerencia: 'seguridad' },
  { username: 'operador1',  password: 'Operador2024!', nombre: 'Ana Torres',            rol: 'operador', gerencia: 'seguridad' },
  { username: 'operador2',  password: 'Operador2024!', nombre: 'Luis Mamani',           rol: 'operador', gerencia: 'fiscalizacion' },
  { username: 'supervisor1',password: 'Super2024!',    nombre: 'María Condori',         rol: 'supervisor',gerencia: 'ambiental' },
  { username: 'visor1',     password: 'Visor2024!',    nombre: 'Jorge Salas',           rol: 'visor',    gerencia: 'all' },
];

const REPORTES_DEMO = [
  { idString: 'DEMO-001', grupo: 'seguridad',    categoria: 'Robo / Asalto',       prioridad: 'Alta',  estado: 'nuevo',      mensaje: '[MÓVIL] Robo a transeúnte en la esquina de la plaza principal', sector: 'Centro',    lat: -12.0464, lng: -77.0428, grupoWhatsapp: 'App Móvil', reportadoPor: 'Ana Torres',  ubicacion: 'Plaza Central', areasDerivadas: '["seguridad"]' },
  { idString: 'DEMO-002', grupo: 'seguridad',    categoria: 'Persona Sospechosa',  prioridad: 'Media', estado: 'en_proceso', mensaje: '[MÓVIL] Persona sospechosa merodeando el parque', sector: 'Norte',     lat: -12.0412, lng: -77.0389, grupoWhatsapp: 'App Móvil', reportadoPor: 'Luis Mamani', ubicacion: 'Parque Norte',  areasDerivadas: '["seguridad","fiscalizacion"]' },
  { idString: 'DEMO-003', grupo: 'ambiental',    categoria: 'Residuos Sólidos',    prioridad: 'Baja',  estado: 'atendido',   mensaje: '[MÓVIL] Acumulación de basura en la vía pública', sector: 'Sur',       lat: -12.0521, lng: -77.0467, grupoWhatsapp: 'App Móvil', reportadoPor: 'Ana Torres',  ubicacion: 'Av. Los Pinos', areasDerivadas: '["ambiental"]' },
  { idString: 'DEMO-004', grupo: 'urbano',       categoria: 'Obra sin autorización',prioridad: 'Alta', estado: 'nuevo',      mensaje: '[MÓVIL] Construcción sin licencia en jirón comercial', sector: 'Este',     lat: -12.0478, lng: -77.0401, grupoWhatsapp: 'App Móvil', reportadoPor: 'Luis Mamani', ubicacion: 'Jr. Comercio',  areasDerivadas: '["urbano"]' },
  { idString: 'DEMO-005', grupo: 'seguridad',    categoria: 'Ruido Excesivo',      prioridad: 'Baja',  estado: 'atendido',   mensaje: '[MÓVIL] Local comercial con música excesiva', sector: 'Centro',    lat: -12.0455, lng: -77.0441, grupoWhatsapp: 'App Móvil', reportadoPor: 'Ana Torres',  ubicacion: 'Calle Lima',    areasDerivadas: '["seguridad"]' },
  { idString: 'DEMO-006', grupo: 'ambiental',    categoria: 'Desmonte',            prioridad: 'Media', estado: 'en_proceso', mensaje: '[MÓVIL] Desmonte arrojado en berma', sector: 'Oeste',      lat: -12.0503, lng: -77.0453, grupoWhatsapp: 'App Móvil', reportadoPor: 'María Condori',ubicacion: 'Av. Progreso', areasDerivadas: '["ambiental"]' },
];

const INCIDENCIAS_DEMO = [
  { tipo: 'Accidente de tránsito', descripcion: 'Choque entre vehículos en cruce peatonal', sector: 'Centro', direccion: 'Av. Principal 101', lat: -12.0460, lng: -77.0430, prioridad: 'alta',  estado: 'en_proceso' },
  { tipo: 'Fuga de agua',          descripcion: 'Rotura de tubería en la calzada',           sector: 'Norte',  direccion: 'Jr. Las Flores 220', lat: -12.0415, lng: -77.0395, prioridad: 'media', estado: 'pendiente' },
  { tipo: 'Árbol caído',           descripcion: 'Árbol bloqueando la vía tras lluvia',       sector: 'Sur',    direccion: 'Calle Los Pinos 45', lat: -12.0518, lng: -77.0470, prioridad: 'alta',  estado: 'atendida' },
];

const LICENCIAS_DEMO = [
  { negocio: 'Restaurante El Buen Sabor', ruc: '20123456781', rubro: 'Restaurante',      direccion: 'Av. Principal 310', sector: 'Centro', fecha_emision: '2024-01-15', fecha_vencimiento: '2025-01-15', estado: 'activa' },
  { negocio: 'Farmacia Salud Total',       ruc: '20123456782', rubro: 'Farmacia',         direccion: 'Jr. Las Flores 88',  sector: 'Norte',  fecha_emision: '2023-06-01', fecha_vencimiento: '2024-06-01', estado: 'vencida' },
  { negocio: 'Bodega Los Amigos',          ruc: '20123456783', rubro: 'Comercio minorista',direccion: 'Calle Lima 55',     sector: 'Centro', fecha_emision: '2024-03-20', fecha_vencimiento: '2025-03-20', estado: 'activa' },
];

const OBRAS_DEMO = [
  { nombre: 'Parchado de pistas - Sector Centro',   ubicacion: 'Av. Principal cuadra 3-8', avance: 65, plazo: '2025-03-31', estado: 'en_plazo',   presupuesto: 85000.00 },
  { nombre: 'Mejoramiento parque Sector Norte',      ubicacion: 'Parque Norte s/n',         avance: 30, plazo: '2025-06-30', estado: 'en_plazo',   presupuesto: 120000.00 },
  { nombre: 'Instalación luminarias LED - Sur',     ubicacion: 'Calle Los Pinos 1-20',     avance: 10, plazo: '2025-02-28', estado: 'retraso',    presupuesto: 45000.00 },
  { nombre: 'Construcción cunetas - Sector Este',    ubicacion: 'Jr. Comercio cuadra 1-5',  avance: 100, plazo: '2024-12-31', estado: 'culminada', presupuesto: 62000.00 },
];

// ── Setup principal ───────────────────────────────────────────────────────────

async function main() {
  console.log('\n[SGTI Dev Setup] Iniciando...\n');

  // 1. Conectar
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a BD establecida');
  } catch (err) {
    console.error('❌ No se pudo conectar a la BD:', err.message);
    console.error('   Verifica que MySQL esté corriendo y que .env tenga las credenciales correctas.');
    process.exit(1);
  }

  // 2. Crear tablas (sin borrar las existentes)
  await sequelize.sync({ force: false, alter: false });
  console.log('✅ Tablas creadas / verificadas');

  // 3. SuperAdmin
  const saPass = await bcrypt.hash('SuperAdmin2024!', 10);
  const [sa, saCreated] = await SuperAdmin.findOrCreate({
    where: { username: 'superadmin' },
    defaults: { password: saPass, nombre: 'Super Administrador' },
  });
  console.log(saCreated ? '✅ SuperAdmin creado' : '  ℹ  SuperAdmin ya existe');

  // 4. Organización demo
  const [org, orgCreated] = await Organizacion.findOrCreate({
    where: { id: ORG_ID },
    defaults: ORG_DEMO,
  });
  console.log(orgCreated ? '✅ Organización demo creada' : '  ℹ  Organización demo ya existe');

  // 5. Modelos con scope
  const { getScopedModels } = require('../database/unified');
  const M = getScopedModels(ORG_ID);

  // 6. Gerencias
  for (const g of GERENCIAS_DEMO) {
    const [, created] = await M.Gerencia.findOrCreate
      ? await (async () => {
          const existing = await M.Gerencia.findOne({ where: { clave: g.clave } });
          if (existing) return [existing, false];
          const created = await M.Gerencia.create(g);
          return [created, true];
        })()
      : [null, false];
    if (created) console.log(`  + Gerencia: ${g.nombre}`);
  }
  console.log('✅ Gerencias verificadas');

  // 7. Usuarios
  for (const u of USUARIOS_DEMO) {
    const existing = await M.Usuario.findOne({ where: { username: u.username } });
    if (!existing) {
      const hashed = await bcrypt.hash(u.password, 10);
      await M.Usuario.create({ ...u, password: hashed });
      console.log(`  + Usuario: ${u.username} (${u.rol})`);
    }
  }
  console.log('✅ Usuarios verificados');

  // 8. Reportes ficticios
  const now = new Date();
  for (const r of REPORTES_DEMO) {
    const existing = await M.MensajeWhatsapp.findOne({ where: { idString: r.idString } });
    if (!existing) {
      await M.MensajeWhatsapp.create({ ...r, fecha: now });
      console.log(`  + Reporte: ${r.idString}`);
    }
  }
  console.log('✅ Reportes verificados');

  // 9. Incidencias
  for (const inc of INCIDENCIAS_DEMO) {
    const existing = await M.Incidencia.findOne({ where: { tipo: inc.tipo, direccion: inc.direccion } });
    if (!existing) {
      await M.Incidencia.create(inc);
      console.log(`  + Incidencia: ${inc.tipo}`);
    }
  }
  console.log('✅ Incidencias verificadas');

  // 10. Licencias
  for (const lic of LICENCIAS_DEMO) {
    const existing = await M.Licencia.findOne({ where: { ruc: lic.ruc } });
    if (!existing) {
      await M.Licencia.create(lic);
      console.log(`  + Licencia: ${lic.negocio}`);
    }
  }
  console.log('✅ Licencias verificadas');

  // 11. Obras
  for (const obra of OBRAS_DEMO) {
    const existing = await M.Obra.findOne({ where: { nombre: obra.nombre } });
    if (!existing) {
      await M.Obra.create(obra);
      console.log(`  + Obra: ${obra.nombre}`);
    }
  }
  console.log('✅ Obras verificadas');

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log(' SGTI Municipal — Entorno local listo');
  console.log('══════════════════════════════════════════════');
  console.log('\n Cuentas de acceso (municipalidad "demo"):');
  console.log('');
  console.log('  SUPERADMIN (panel /superadmin):');
  console.log('    usuario:    superadmin');
  console.log('    contraseña: SuperAdmin2024!');
  console.log('');
  console.log('  ADMIN:');
  console.log('    usuario:    admin       contraseña: Admin2024!');
  console.log('  GERENTE:');
  console.log('    usuario:    gerente1    contraseña: Gerente2024!');
  console.log('  OPERADORES:');
  console.log('    usuario:    operador1   contraseña: Operador2024!');
  console.log('    usuario:    operador2   contraseña: Operador2024!');
  console.log('  SUPERVISOR:');
  console.log('    usuario:    supervisor1 contraseña: Super2024!');
  console.log('  VISOR:');
  console.log('    usuario:    visor1      contraseña: Visor2024!');
  console.log('');
  console.log(' URL local:  http://demo.localhost:3001');
  console.log('    o bien:  http://localhost:3001?tenant=demo');
  console.log('');
  console.log('══════════════════════════════════════════════\n');

  await sequelize.close();
}

main().catch(err => {
  console.error('Error durante el setup:', err);
  process.exit(1);
});
