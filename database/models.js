// Shim de compatibilidad: exporta los modelos raw de la BD unificada.
// Las rutas deben preferir req.models (con scope por organizationId).
const { ALL_MODELS } = require('./unified');
module.exports = { ...ALL_MODELS };
