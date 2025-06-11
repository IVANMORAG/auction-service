// services/auctionScheduler.js - CORREGIDO
const cron = require('node-cron');
const Auction = require('../models/Auction');
const { finalizeAuction } = require('../controllers/auctionController');
const logger = require('../utils/logger');

class AuctionScheduler {
  constructor() {
    this.job = null;
    this.isRunning = false;
    this.lastCheck = null;
    this.processedCount = 0;
    this.errorCount = 0;
  }

  // Iniciar el scheduler
  start() {
    if (this.isRunning) {
      logger.warn('🔄 Scheduler ya está corriendo');
      return;
    }

    // ✅ CORREGIDO: Ejecutar cada 30 segundos para verificar subastas expiradas
    this.job = cron.schedule('*/30 * * * * *', async () => {
      await this.checkExpiredAuctions();
    }, {
      scheduled: false
    });

    this.job.start();
    this.isRunning = true;
    logger.info('🕒 Auction scheduler iniciado - verificando cada 30 segundos');
    
    // ✅ EJECUTAR INMEDIATAMENTE al inicio
    setTimeout(() => {
      this.checkExpiredAuctions();
    }, 1000);
  }

  // Parar el scheduler
  stop() {
    if (this.job) {
      this.job.stop();
      this.isRunning = false;
      logger.info('🛑 Auction scheduler detenido');
    }
  }

  // ✅ FUNCIÓN CORREGIDA: Verificar y cerrar subastas expiradas
async checkExpiredAuctions() {
  if (!this.isRunning) return;
  
  try {
    const now = new Date();
    logger.info(`🔍 Verificando subastas expiradas - ${now.toISOString()}`);
    
    const expiredAuctions = await Auction.find({
      status: 'active',
      $or: [
        { endTime: { $lte: now } },
        { end_time: { $lte: now } }
      ],
      isFinalized: false
    });

    logger.info(`📊 Subastas expiradas encontradas: ${expiredAuctions.length}`);

    for (const auction of expiredAuctions) {
      try {
        logger.info(`⏳ Finalizando subasta: ${auction._id}`);
        // Pasar un token nulo por ahora; usar un token de servicio más adelante
        await finalizeAuction(auction._id, null);
        this.processedCount++;
      } catch (error) {
        this.errorCount++;
        logger.error(`❌ Error finalizando subasta ${auction._id}:`, error);
      }
    }
  } catch (error) {
    this.error('❌ Error general en checkExpiredAuctions:', error);
  }
}

  // ✅ NUEVA FUNCIÓN: Forzar verificación manual
  async forceCheck() {
    logger.info('🔧 Verificación manual forzada');
    await this.checkExpiredAuctions();
  }

  // Finalizar subasta específica manualmente
  async finalizeSpecificAuction(auctionId) {
    try {
      logger.info(`🎯 Finalizando subasta específica: ${auctionId}`);
      await finalizeAuction(auctionId);
      this.processedCount++;
      logger.info(`✅ Subasta ${auctionId} finalizada manualmente`);
      return { success: true, message: 'Subasta finalizada exitosamente' };
    } catch (error) {
      this.errorCount++;
      logger.error(`❌ Error finalizando subasta ${auctionId}:`, error);
      throw error;
    }
  }

  // ✅ FUNCIÓN MEJORADA: Obtener estadísticas del scheduler
  getStats() {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck?.toISOString() || null,
      schedulerPattern: '*/30 * * * * *', // cada 30 segundos
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      uptime: this.lastCheck ? Date.now() - this.lastCheck.getTime() : 0
    };
  }

  // ✅ NUEVA FUNCIÓN: Obtener subastas que necesitan ser finalizadas
  async getPendingAuctions() {
    try {
      const now = new Date();
      
      const pendingAuctions = await Auction.find({
        status: 'active',
        $or: [
          { endTime: { $lte: now } },
          { end_time: { $lte: now } }
        ],
        $or: [
          { isFinalized: false },
          { isFinalized: { $exists: false } }
        ]
      }).select('_id title endTime end_time status isFinalized');

      return pendingAuctions.map(auction => ({
        id: auction._id,
        title: auction.title,
        endTime: auction.endTime || auction.end_time,
        status: auction.status,
        isFinalized: auction.isFinalized,
        minutesOverdue: Math.floor((now - new Date(auction.endTime || auction.end_time)) / (1000 * 60))
      }));
    } catch (error) {
      logger.error('❌ Error obteniendo subastas pendientes:', error);
      return [];
    }
  }

  // ✅ NUEVA FUNCIÓN: Resetear contadores
  resetStats() {
    this.processedCount = 0;
    this.errorCount = 0;
    logger.info('📊 Estadísticas del scheduler reseteadas');
  }
}

module.exports = new AuctionScheduler();