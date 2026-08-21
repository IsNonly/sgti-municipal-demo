/**
 * seed-mapa.js
 * Carga 50 reportes ficticios con coordenadas reales distribuidos en los
 * ultimos 7 dias, simulando actividad del APK movil en el mapa.
 * Uso: node scripts/seed-mapa.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Sequelize } = require('sequelize');

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

const ORG = 'demo';
const NOW = Date.now();
const hace = (h) => new Date(NOW - h * 3600000).toISOString().slice(0,19).replace('T',' ');

// Coordenadas dentro del area de Carmen de La Legua / Callao / Lima (reales)
const PUNTOS = [
  { lat: -12.0435, lng: -77.0955, dir: 'Av. Argentina 2100', sector: 'Sector 1' },
  { lat: -12.0448, lng: -77.0921, dir: 'Jr. Manco Capac 350', sector: 'Sector 2' },
  { lat: -12.0462, lng: -77.0978, dir: 'Av. Morales Duarez 1800', sector: 'Sector 3' },
  { lat: -12.0419, lng: -77.0943, dir: 'Calle Los Andes 120', sector: 'Sector 4' },
  { lat: -12.0471, lng: -77.0962, dir: 'Av. Gambetta 3200', sector: 'Sector 5' },
  { lat: -12.0388, lng: -77.0931, dir: 'Jr. San Martin 450', sector: 'Sector 6' },
  { lat: -12.0502, lng: -77.0889, dir: 'Av. Peru 1500', sector: 'Sector 7' },
  { lat: -12.0423, lng: -77.0998, dir: 'Psje. Los Rosales 80', sector: 'Sector 8' },
  { lat: -12.0456, lng: -77.0867, dir: 'Av. Universitaria 2800', sector: 'Sector 9' },
  { lat: -12.0391, lng: -77.0912, dir: 'Jr. Bolivar 620', sector: 'Sector 10' },
  { lat: -12.0478, lng: -77.0934, dir: 'Calle Union 200', sector: 'Sector 1' },
  { lat: -12.0441, lng: -77.0904, dir: 'Av. Colonial 3100', sector: 'Sector 2' },
  { lat: -12.0465, lng: -77.0948, dir: 'Jr. Huascar 180', sector: 'Sector 3' },
  { lat: -12.0398, lng: -77.0967, dir: 'Av. Venezuela 3400', sector: 'Sector 4' },
  { lat: -12.0487, lng: -77.0915, dir: 'Calle Real 90', sector: 'Sector 5' },
  { lat: -12.0412, lng: -77.0881, dir: 'Av. Republica 500', sector: 'Sector 6' },
  { lat: -12.0453, lng: -77.0973, dir: 'Jr. Grau 340', sector: 'Sector 7' },
  { lat: -12.0432, lng: -77.0941, dir: 'Psje. Las Flores 55', sector: 'Sector 8' },
  { lat: -12.0469, lng: -77.0908, dir: 'Av. Zarumilla 1200', sector: 'Sector 9' },
  { lat: -12.0415, lng: -77.0955, dir: 'Jr. Tupac Amaru 270', sector: 'Sector 10' },
];

const GRUPOS = ['seguridad', 'seguridad', 'seguridad', 'fiscalizacion', 'limpieza', 'transito'];
const CATS = {
  seguridad:     ['robo_al_paso', 'disturbio', 'vandalismo', 'persona_sospechosa', 'pelea', 'ruido_nocturno'],
  fiscalizacion: ['local_sin_licencia', 'publicidad_ilegal', 'ambulante', 'obstruccion_via'],
  limpieza:      ['basura_acumulada', 'desmonte', 'punto_critico_residuos', 'animales_en_via'],
  transito:      ['accidente_vehicular', 'vehiculo_mal_estacionado', 'semaforo_averiado', 'via_bloqueada'],
};
const ESTADOS  = ['nuevo', 'nuevo', 'nuevo', 'en_proceso', 'en_proceso', 'atendida'];
const PRIORIDADES = ['Alta', 'Alta', 'Media', 'Media', 'Media', 'Baja'];
const OPERADORES = ['Carlos Mendoza', 'Sofia Quispe', 'Luis Torres', 'Ana Flores', 'Jorge Ramirez'];
const TELEFONOS  = ['999111001', '999111002', '999111003', '999111004', '999111005'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function run() {
  await sequelize.authenticate();
  console.log('Conectado. Generando reportes del mapa...');

  // Eliminar los MOB- anteriores del demo para empezar limpio
  await sequelize.query(`DELETE FROM "MensajeWhatsapps" WHERE "organizationId" = '${ORG}' AND "idString" LIKE 'MOB-%'`).catch(()=>{});
  await sequelize.query(`DELETE FROM "MensajeWhatsapps" WHERE "organizationId" = '${ORG}' AND "idString" LIKE 'DEMO-%'`).catch(()=>{});

  const registros = [];
  for (let i = 1; i <= 50; i++) {
    const punto    = PUNTOS[i % PUNTOS.length];
    const grupo    = pick(GRUPOS);
    const cats     = CATS[grupo];
    const cat      = pick(cats);
    const estado   = pick(ESTADOS);
    const prio     = pick(PRIORIDADES);
    const operador = pick(OPERADORES);
    const telef    = pick(TELEFONOS);
    const horasAtras = Math.floor(Math.random() * 168); // hasta 7 dias atras
    const fecha    = hace(horasAtras);
    const id       = `MOB-${String(Date.now() + i).slice(-6)}`;
    const areas    = grupo === 'fiscalizacion'
      ? `["seguridad","fiscalizacion"]`
      : `["${grupo}"]`;
    const asignado = estado !== 'nuevo' ? pick(OPERADORES) : null;

    // Variacion leve en coordenadas para que no se apilen exacto
    const latVar = punto.lat + (Math.random() - 0.5) * 0.003;
    const lngVar = punto.lng + (Math.random() - 0.5) * 0.003;

    registros.push(
      `('${id}', '${ORG}', '${fecha}', '${grupo}', 'Grupo ${grupo} Demo', '${operador}', '${telef}',` +
      `'[DEMO] ${cat.replace(/_/g,' ')} reportado en ${punto.dir}',` +
      `'${cat}', '${prio}', '${punto.sector}', '${punto.dir}', '${punto.dir}',` +
      `${latVar.toFixed(6)}, ${lngVar.toFixed(6)}, '${estado}',` +
      `'${areas}', false,` +
      `${asignado ? `'${asignado}'` : 'NULL'},` +
      `NOW(), NOW())`
    );
  }

  const cols = `"idString","organizationId","fecha","grupo","grupoWhatsapp","reportadoPor","telefono","mensaje","categoria","prioridad","sector","ubicacion","direccionExtraida","lat","lng","estado","areasDerivadas","esDerivacionMultiple","asignadoA","createdAt","updatedAt"`;

  // Insertar en lotes de 10
  for (let i = 0; i < registros.length; i += 10) {
    const lote = registros.slice(i, i + 10);
    await sequelize.query(`INSERT INTO "MensajeWhatsapps" (${cols}) VALUES ${lote.join(',')}`);
    process.stdout.write(`  ${i + lote.length}/50\r`);
  }

  console.log('\n50 reportes del mapa cargados correctamente.');
  console.log('Distribuidos en los ultimos 7 dias, con coordenadas reales en el area demo.');

  // Resumen por grupo
  const [stats] = await sequelize.query(
    `SELECT grupo, estado, COUNT(*) as total FROM "MensajeWhatsapps" WHERE "organizationId"='${ORG}' GROUP BY grupo, estado ORDER BY grupo, estado`
  );
  console.log('\nResumen:');
  stats.forEach(r => console.log(`  ${r.grupo.padEnd(15)} ${r.estado.padEnd(12)} ${r.total}`));

  await sequelize.close();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
