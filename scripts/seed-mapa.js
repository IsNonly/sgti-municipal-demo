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

// Coordenadas dentro de Carmen de la Legua-Reynoso (Callao)
const PUNTOS = [
  { lat: -12.0385, lng: -77.0923, dir: 'Av. Argentina 1850',         sector: 'Sector A' },
  { lat: -12.0392, lng: -77.0941, dir: 'Jr. San Martin 230',         sector: 'Sector A' },
  { lat: -12.0401, lng: -77.0908, dir: 'Calle Los Andes 45',         sector: 'Sector A' },
  { lat: -12.0378, lng: -77.0956, dir: 'Av. Morales Duarez 1600',    sector: 'Sector A' },
  { lat: -12.0412, lng: -77.0932, dir: 'Jr. Bolivar 410',            sector: 'Sector B' },
  { lat: -12.0421, lng: -77.0917, dir: 'Psje. Los Girasoles 12',     sector: 'Sector B' },
  { lat: -12.0408, lng: -77.0948, dir: 'Calle Real 88',              sector: 'Sector B' },
  { lat: -12.0433, lng: -77.0904, dir: 'Jr. Manco Capac 180',        sector: 'Sector B' },
  { lat: -12.0426, lng: -77.0961, dir: 'Av. Colonial 2980',          sector: 'Sector B' },
  { lat: -12.0445, lng: -77.0925, dir: 'Jr. Grau 155',               sector: 'Sector C' },
  { lat: -12.0438, lng: -77.0942, dir: 'Calle Union 67',             sector: 'Sector C' },
  { lat: -12.0452, lng: -77.0911, dir: 'Psje. Las Flores 33',        sector: 'Sector C' },
  { lat: -12.0461, lng: -77.0938, dir: 'Jr. Huascar 90',             sector: 'Sector C' },
  { lat: -12.0457, lng: -77.0954, dir: 'Av. Venezuela 3210',         sector: 'Sector C' },
  { lat: -12.0473, lng: -77.0919, dir: 'Jr. Tupac Amaru 205',        sector: 'Sector D' },
  { lat: -12.0468, lng: -77.0903, dir: 'Calle Progreso 14',          sector: 'Sector D' },
  { lat: -12.0481, lng: -77.0935, dir: 'Av. Republica 440',          sector: 'Sector D' },
  { lat: -12.0476, lng: -77.0952, dir: 'Jr. Zarumilla 780',          sector: 'Sector D' },
  { lat: -12.0489, lng: -77.0916, dir: 'Psje. El Porvenir 8',        sector: 'Sector D' },
  { lat: -12.0495, lng: -77.0944, dir: 'Av. Peru 1320',              sector: 'Sector E' },
  { lat: -12.0503, lng: -77.0927, dir: 'Jr. Libertad 67',            sector: 'Sector E' },
  { lat: -12.0498, lng: -77.0908, dir: 'Calle Los Pinos 22',         sector: 'Sector E' },
  { lat: -12.0511, lng: -77.0939, dir: 'Jr. Callao 310',             sector: 'Sector E' },
  { lat: -12.0507, lng: -77.0955, dir: 'Av. Gambetta 3050',          sector: 'Sector E' },
  { lat: -12.0395, lng: -77.0965, dir: 'Psje. Los Rosales 5',        sector: 'Sector F' },
  { lat: -12.0416, lng: -77.0972, dir: 'Jr. San Juan 140',           sector: 'Sector F' },
  { lat: -12.0437, lng: -77.0968, dir: 'Calle Dos de Mayo 78',       sector: 'Sector F' },
  { lat: -12.0459, lng: -77.0971, dir: 'Av. Zarumilla 1100',         sector: 'Sector F' },
  { lat: -12.0482, lng: -77.0966, dir: 'Jr. Independencia 55',       sector: 'Sector F' },
  { lat: -12.0388, lng: -77.0898, dir: 'Calle Los Laureles 19',      sector: 'Sector G' },
  { lat: -12.0409, lng: -77.0891, dir: 'Jr. Ancash 320',             sector: 'Sector G' },
  { lat: -12.0431, lng: -77.0886, dir: 'Av. Universitaria 2650',     sector: 'Sector G' },
  { lat: -12.0453, lng: -77.0880, dir: 'Psje. Santa Rosa 3',         sector: 'Sector G' },
  { lat: -12.0474, lng: -77.0892, dir: 'Jr. Puno 88',                sector: 'Sector G' },
  { lat: -12.0497, lng: -77.0883, dir: 'Calle El Parque 41',         sector: 'Sector G' },
  { lat: -12.0519, lng: -77.0895, dir: 'Av. Elmer Faucett 200',      sector: 'Sector G' },
  { lat: -12.0402, lng: -77.0975, dir: 'Jr. Tacna 67',               sector: 'Sector H' },
  { lat: -12.0444, lng: -77.0979, dir: 'Calle Collasuyo 30',         sector: 'Sector H' },
  { lat: -12.0466, lng: -77.0983, dir: 'Jr. Loreto 150',             sector: 'Sector H' },
  { lat: -12.0488, lng: -77.0977, dir: 'Av. Guardia Chalaca 980',    sector: 'Sector H' },
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

  // Actualizar centro del mapa a Carmen de la Legua
  await sequelize.query(`UPDATE "Configuraciones" SET "valor"='-12.0457' WHERE "organizationId"='${ORG}' AND "clave"='lat_centro'`).catch(()=>{});
  await sequelize.query(`UPDATE "Configuraciones" SET "valor"='-77.0935' WHERE "organizationId"='${ORG}' AND "clave"='lng_centro'`).catch(()=>{});

  // Eliminar los MOB- anteriores del demo para empezar limpio
  await sequelize.query(`DELETE FROM "MensajeWhatsapps" WHERE "organizationId" = '${ORG}' AND "idString" LIKE 'MOB-%'`).catch(()=>{});
  await sequelize.query(`DELETE FROM "MensajeWhatsapps" WHERE "organizationId" = '${ORG}' AND "idString" LIKE 'DEMO-%'`).catch(()=>{});

  const registros = [];
  for (let i = 1; i <= 200; i++) {
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
    process.stdout.write(`  ${i + lote.length}/200\r`);
  }

  console.log('\n200 reportes del mapa cargados correctamente.');
  console.log('Distribuidos en los ultimos 7 dias, con coordenadas reales en Lima y Callao.');

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
