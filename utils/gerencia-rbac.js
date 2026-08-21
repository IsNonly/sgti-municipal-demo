// Resuelve dinámicamente qué claves de grupo puede ver un usuario según su gerencia.
// Consulta la tabla Gerencia para sub-áreas (parentClave) en lugar de mapas estáticos.
async function getAreasPermitidas(Gerencia, parentClave) {
  const base = [parentClave];
  if (!Gerencia || !parentClave) return base;
  try {
    const subAreas = await Gerencia.findAll({
      where: { parentClave, esSubArea: true },
      attributes: ['clave'],
      raw: true
    });
    return [...base, ...subAreas.map(s => s.clave)];
  } catch (e) { return base; }
}

// Construye la condición Op.or para filtrar MensajeWhatsapp por gerencia del usuario.
// Retorna null si el usuario tiene acceso total (all / municipal).
async function buildGerenciaWhere(req, Op) {
  if (!req.user || req.user.gerencia === 'all' || req.user.gerencia === 'municipal') return null;
  const Gerencia = (req.models || require('../database/models')).Gerencia;
  const areas = await getAreasPermitidas(Gerencia, req.user.gerencia);
  return {
    [Op.or]: [
      { grupo: areas },
      ...areas.map(a => ({ areasDerivadas: { [Op.like]: `%"${a}"%` } }))
    ]
  };
}

module.exports = { getAreasPermitidas, buildGerenciaWhere };
