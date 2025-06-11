const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');
const authMiddleware = require('../middleware/authMiddleware');
const { 
  getAuctionStatus, 
  debugBidService, 
  testFinalizeAuction, 
  getAllBidsForAuction,
  triggerExpiredAuctionsCheck // ✅ Agregar esta nueva función
} = require('../controllers/auctionController');

// RUTAS PRINCIPALES (CRUD y acceso público)
router.post('/', authMiddleware, auctionController.createAuction);
router.put('/:id', authMiddleware, auctionController.updateAuction);
router.delete('/:id', authMiddleware, auctionController.cancelAuction);
router.get('/', auctionController.getAuctions);
router.get('/:id', auctionController.getAuctionById);
router.get('/category/:category', auctionController.getAuctionsByCategory);

// RUTAS DE GESTIÓN (Administrativas)
router.patch('/:id/close', authMiddleware, auctionController.closeAuction);
router.get('/winners/list', auctionController.getAuctionWinners);

// RUTAS DE DEPURACIÓN (Debugging)
router.get('/debug/status', getAuctionStatus);
router.get('/debug/bid-service/:auctionId', debugBidService);
router.post('/debug/finalize/:auctionId', testFinalizeAuction);
router.get('/debug/bids/:auctionId', getAllBidsForAuction);

// ✅ NUEVA RUTA: Para finalizar subastas expiradas manualmente
router.post('/admin/finalize-expired', triggerExpiredAuctionsCheck);

module.exports = router;
