// Shim de compatibilidad: redirige al módulo unificado.
const { sequelize } = require('./unified');

class Database {
  constructor() { this.connected = false; this.sequelize = sequelize; }
  async connect() {
    try {
      await sequelize.authenticate();
      this.connected = true;
      console.log('✅ BD unificada conectada.');
      return true;
    } catch (err) {
      console.error('❌ Error conectando BD unificada:', err.message);
      return false;
    }
  }
  isConnected() { return this.connected; }
}

module.exports = new Database();
