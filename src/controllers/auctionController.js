const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Category = require('../models/Category');
const ntpService = require('../services/ntpService');
const logger = require('../utils/logger');
const axios = require('axios');


// Crear una subasta
const createAuction = async (req, res) => {
  try {
    const { title, description, startPrice, start_price, endTime, end_time, categoryId } = req.body;
    const ownerId = req.user.id;

    const price = startPrice || start_price;
    const finalTime = endTime || end_time;

    if (!title || !description || !price || !finalTime || !categoryId) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos',
        success: false 
      });
    }

    if (price <= 0) {
      return res.status(400).json({ 
        error: 'El precio inicial debe ser mayor a 0',
        success: false 
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ 
        error: 'Categoría no encontrada',
        success: false 
      });
    }

    const currentTime = await ntpService.getTime();
    if (new Date(finalTime) <= currentTime) {
      return res.status(400).json({ 
        error: 'El tiempo de finalización debe ser futuro',
        success: false 
      });
    }

    const auction = new Auction({
      title,
      description,
      startPrice: price,
      start_price: price,
      currentPrice: price,
      current_price: price,
      endTime: finalTime,
      end_time: finalTime,
      ownerId,
      owner_id: ownerId,
      categoryId,
      status: 'active',
      winnerId: null,
      winningBid: null,
      isFinalized: false
    });

    await auction.save();
    logger.info(`Subasta creada: ${auction._id}`);
    
    res.status(201).json({
      success: true,
      data: auction,
      message: 'Subasta creada exitosamente'
    });
  } catch (error) {
    logger.error('Error creando subasta:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Listar subastas
const getAuctions = async (req, res) => {
  try {
    const { status } = req.query;
    
    let filters = { status: 'active' };
    
    if (status) {
      const statusArray = status.split(',');
      filters.status = { $in: statusArray };
    }
    
    const auctions = await Auction.find(filters)
      .populate('categoryId')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: auctions
    });
  } catch (error) {
    logger.error('Error listando subastas:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Obtener subasta específica
const getAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id).populate('categoryId');
    if (!auction) {
      return res.status(404).json({ 
        error: 'Subasta no encontrada',
        success: false 
      });
    }
    
    res.json({
      success: true,
      data: auction
    });
  } catch (error) {
    logger.error('Error obteniendo subasta:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Actualizar subasta
const updateAuction = async (req, res) => {
  try {
    const { title, description, endTime, end_time, categoryId } = req.body;
    const auction = await Auction.findById(req.params.id);
    
    if (!auction) {
      return res.status(404).json({ 
        error: 'Subasta no encontrada',
        success: false 
      });
    }

    if (auction.ownerId.toString() !== req.user.id && auction.owner_id?.toString() !== req.user.id) {
      return res.status(403).json({ 
        error: 'No autorizado',
        success: false 
      });
    }

    if (auction.currentPrice > auction.startPrice || auction.current_price > auction.start_price) {
      return res.status(400).json({ 
        error: 'No se puede actualizar una subasta que ya tiene ofertas',
        success: false 
      });
    }

    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ 
          error: 'Categoría no encontrada',
          success: false 
        });
      }
    }

    const finalTime = endTime || end_time;
    if (finalTime) {
      const currentTime = await ntpService.getTime();
      if (new Date(finalTime) <= currentTime) {
        return res.status(400).json({ 
          error: 'El tiempo de finalización debe ser futuro',
          success: false 
        });
      }
    }

    if (title) auction.title = title;
    if (description) auction.description = description;
    if (finalTime) {
      auction.endTime = finalTime;
      auction.end_time = finalTime;
    }
    if (categoryId) auction.categoryId = categoryId;

    await auction.save();
    logger.info(`Subasta actualizada: ${auction._id}`);
    
    res.json({
      success: true,
      data: auction,
      message: 'Subasta actualizada exitosamente'
    });
  } catch (error) {
    logger.error('Error actualizando subasta:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Cancelar subasta
const cancelAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ 
        error: 'Subasta no encontrada',
        success: false 
      });
    }

    if (auction.ownerId.toString() !== req.user.id && auction.owner_id?.toString() !== req.user.id) {
      return res.status(403).json({ 
        error: 'No autorizado',
        success: false 
      });
    }

    if (auction.status === 'cancelled') {
      return res.status(400).json({ 
        error: 'La subasta ya está cancelada',
        success: false 
      });
    }

    if (auction.status === 'closed') {
      return res.status(400).json({ 
        error: 'No se puede cancelar una subasta cerrada',
        success: false 
      });
    }

    auction.status = 'cancelled';
    await auction.save();
    logger.info(`Subasta cancelada: ${auction._id}`);
    
    res.json({
      success: true,
      message: 'Subasta cancelada exitosamente'
    });
  } catch (error) {
    logger.error('Error cancelando subasta:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Cerrar subasta manualmente
const closeAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ 
        error: 'Subasta no encontrada',
        success: false 
      });
    }

    if (auction.ownerId.toString() !== req.user.id && auction.owner_id?.toString() !== req.user.id) {
      return res.status(403).json({ 
        error: 'No autorizado',
        success: false 
      });
    }

    if (auction.status !== 'active') {
      return res.status(400).json({ 
        error: 'Solo se pueden cerrar subastas activas',
        success: false 
      });
    }

    const token = req.header('Authorization');
    if (!token) {
      return res.status(401).json({ 
        error: 'Token no proporcionado',
        success: false 
      });
    }

    await finalizeAuction(auction._id, token);
    
    res.json({
      success: true,
      message: 'Subasta cerrada exitosamente'
    });
  } catch (error) {
    logger.error('Error cerrando subasta:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Finalizar subasta y determinar ganador
// Función corregida para finalizeAuction en auctionController.js

// Reemplaza la función finalizeAuction en tu auctionController.js:

// Solo la función finalizeAuction corregida en auctionController.js


const finalizeAuction = async (auctionId, authToken) => {
  try {
    const auction = await Auction.findById(auctionId);
    if (!auction || auction.status !== 'active') {
      logger.warn(`Subasta ${auctionId} no encontrada o ya cerrada`);
      throw new Error(`Subasta ${auctionId} no encontrada o ya cerrada`);
    }

    let highestBidder = null;
    let highestBid = 0;

    try {
      // ✅ CORRECCIÓN PRINCIPAL: URL SIN /api Y CON /bids
      const bidHistoryUrl = `${process.env.BID_SERVICE_URL}/bids/history/${auctionId}`;
      
      console.log(`🔍 Consultando bid service en: ${bidHistoryUrl}`);
      
      const response = await axios.get(bidHistoryUrl, {
        timeout: 5000,
        headers: { 
          'Content-Type': 'application/json',
          // ✅ CORRECCIÓN: Pasar token si existe
          ...(authToken && { Authorization: authToken })
        }
      });

      logger.info(`Respuesta del bid-service para subasta ${auctionId}:`, response.data);

      const bidHistory = response.data;

      if (!bidHistory) {
        logger.error(`No se encontró historial de pujas para subasta ${auctionId}`);
        throw new Error('No se encontró historial de pujas');
      }

      if (bidHistory.highestBidder && bidHistory.highestBid) {
        highestBidder = bidHistory.highestBidder;
        highestBid = bidHistory.highestBid;
        logger.info(`Ganador encontrado para subasta ${auctionId}:`, {
          highestBidder,
          highestBid
        });
      } else if (bidHistory.bidCount === 0) {
        logger.info(`Subasta ${auctionId} no tuvo pujas`);
      } else {
        logger.error(`Historial de pujas inválido para subasta ${auctionId}:`, bidHistory);
        throw new Error('Historial de pujas inválido');
      }
    } catch (error) {
      logger.error('Error obteniendo historial de pujas:', {
        auctionId,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      logger.info(`Cerrando subasta ${auctionId} sin ganador debido a error en bid-service`);
    }

    // ✅ CORRECCIÓN PRINCIPAL: Actualizar el status y isFinalized ANTES de asignar ganador
    auction.status = 'closed';
    auction.isFinalized = true;

    if (highestBidder) {
      // ✅ CORRECCIÓN: Usar new mongoose.Types.ObjectId() en lugar del método deprecated
      try {
        auction.winnerId = new mongoose.Types.ObjectId(highestBidder);
        auction.winningBid = highestBid;
        auction.currentPrice = highestBid;
        auction.current_price = highestBid; // Para compatibilidad
        logger.info(`Ganador asignado correctamente: ${highestBidder}`);
      } catch (objectIdError) {
        logger.error(`Error creando ObjectId para winnerId: ${highestBidder}`, objectIdError);
        // Si el ObjectId falla, intentar asignar directamente
        auction.winnerId = highestBidder;
        auction.winningBid = highestBid;
        auction.currentPrice = highestBid;
        auction.current_price = highestBid;
      }
    } else {
      logger.info(`Subasta ${auctionId} cerrada sin ganador`);
      auction.winnerId = null;
      auction.winningBid = null;
    }

    await auction.save();
    
    // ✅ LOGGING MEJORADO para debug
    logger.info(`Subasta ${auctionId} finalizada exitosamente:`, {
      status: auction.status,
      winnerId: auction.winnerId,
      winningBid: auction.winningBid,
      isFinalized: auction.isFinalized
    });

    return auction;
  } catch (error) {
    logger.error('Error finalizando subasta:', {
      auctionId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// ✅ NUEVA FUNCIÓN: Finalizar subastas expiradas automáticamente
const finalizeExpiredAuctions = async () => {
  try {
    console.log('🕐 Buscando subastas expiradas...');
    
    const currentTime = new Date();
    const expiredAuctions = await Auction.find({
      status: 'active',
      endTime: { $lte: currentTime },
      isFinalized: false
    });

    console.log(`📋 Encontradas ${expiredAuctions.length} subastas expiradas`);

    for (const auction of expiredAuctions) {
      try {
        console.log(`⏰ Finalizando subasta expirada: ${auction._id}`);
        await finalizeAuction(auction._id.toString());
      } catch (error) {
        console.error(`❌ Error finalizando subasta ${auction._id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error en finalizeExpiredAuctions:', error);
  }
};

// ✅ FUNCIÓN PARA LLAMAR MANUALMENTE LA FINALIZACIÓN DE EXPIRADAS
const triggerExpiredAuctionsCheck = async (req, res) => {
  try {
    await finalizeExpiredAuctions();
    res.json({
      success: true,
      message: 'Verificación de subastas expiradas completada'
    });
  } catch (error) {
    console.error('❌ Error en triggerExpiredAuctionsCheck:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};





// ✅ FUNCIÓN ADICIONAL DE DEBUG: Agregar esta función para verificar el estado de las subastas
const getAuctionStatus = async (req, res) => {
  try {
    const closedAuctions = await Auction.find({ status: 'closed' });
    const auctionsWithWinners = await Auction.find({ 
      status: 'closed',
      winnerId: { $exists: true, $ne: null }
    });
    
    const debugInfo = {
      totalClosedAuctions: closedAuctions.length,
      auctionsWithWinners: auctionsWithWinners.length,
      closedAuctionsDetail: closedAuctions.map(auction => ({
        id: auction._id,
        title: auction.title,
        status: auction.status,
        winnerId: auction.winnerId,
        winningBid: auction.winningBid,
        isFinalized: auction.isFinalized
      }))
    };
    
    res.json({
      success: true,
      debug: debugInfo
    });
  } catch (error) {
    logger.error('Error obteniendo estado de subastas:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Obtener resumen de ganadores
// Obtener resumen de ganadores - VERSIÓN CON DEBUG DETALLADO
// Obtener resumen de ganadores - VERSIÓN COMPLETA CON DATOS DE USUARIO
const getAuctionWinners = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    console.log('🏆 Obteniendo lista de ganadores...');
    
    const auctions = await Auction.find({ 
      status: 'closed',
      winnerId: { $exists: true, $ne: null }
    })
    .populate('categoryId', 'name')
    .sort({ endTime: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    console.log(`📋 Encontradas ${auctions.length} subastas con ganadores`);

    const total = await Auction.countDocuments({ 
      status: 'closed',
      winnerId: { $exists: true, $ne: null }
    });

    // ✅ Obtener datos completos de los usuarios ganadores
    const winnersWithUserData = [];
    
    for (const auction of auctions) {
      let winnerData = null;
      
      try {
        console.log(`👤 Obteniendo datos del usuario: ${auction.winnerId}`);
        
        // Hacer request al auth-service usando tu endpoint público
        const userResponse = await axios.get(
          `${process.env.AUTH_SERVICE_URL}/api/auth/public/users/${auction.winnerId}`,
          { 
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        if (userResponse.data.success && userResponse.data.data?.user) {
          const user = userResponse.data.data.user;
          winnerData = {
            _id: user._id,
            email: user.email,
            firstName: user.profile?.firstName || '',
            lastName: user.profile?.lastName || '',
            fullName: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.email,
            phone: user.profile?.phone || '',
            avatar: user.profile?.avatar || '',
            role: user.role,
            isActive: user.isActive
          };
        }
      } catch (userError) {
        console.warn(`⚠️ No se pudo obtener datos del usuario ${auction.winnerId}:`, userError.message);
        // Si no se puede obtener el usuario, usar datos básicos
        winnerData = {
          _id: auction.winnerId,
          email: 'Usuario no encontrado',
          fullName: 'Usuario no encontrado',
          firstName: '',
          lastName: '',
          phone: '',
          avatar: '',
          role: 'unknown',
          isActive: false
        };
      }

      winnersWithUserData.push({
        auctionId: auction._id,
        title: auction.title,
        category: auction.categoryId?.name || 'Sin categoría',
        winner: winnerData,
        winningBid: auction.winningBid,
        endTime: auction.endTime,
        startPrice: auction.startPrice || auction.start_price,
        currentPrice: auction.currentPrice || auction.current_price
      });
    }

    console.log(`✅ Procesados ${winnersWithUserData.length} ganadores con datos de usuario`);

    res.json({
      success: true,
      data: winnersWithUserData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error obteniendo ganadores:', error);
    console.error('❌ Error completo:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false,
      details: error.message
    });
  }
};

// Listar subastas por categoría
const getAuctionsByCategory = async (req, res) => {
  try {
    const auctions = await Auction.find({ 
      categoryId: req.params.category, 
      status: 'active' 
    }).populate('categoryId');
    
    res.json({
      success: true,
      data: auctions
    });
  } catch (error) {
    logger.error('Error listando subastas por categoría:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};


// Función de debug mejorada para diagnosticar el problema con las pujas
// ✅ CORRECCIÓN: Función de debug con URL correcta
const debugBidService = async (req, res) => {
  try {
    const { auctionId } = req.params;
    
    console.log(`🔍 Debugging bid service para subasta: ${auctionId}`);
    
    const debugInfo = {
      auctionId,
      timestamp: new Date().toISOString(),
      bidServiceUrl: process.env.BID_SERVICE_URL,
      steps: []
    };

    // Paso 1: Verificar la subasta
    debugInfo.steps.push("1. Verificando subasta...");
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.json({
        success: false,
        error: "Subasta no encontrada",
        debug: debugInfo
      });
    }
    
    debugInfo.auction = {
      id: auction._id,
      title: auction.title,
      status: auction.status,
      winnerId: auction.winnerId,
      winningBid: auction.winningBid,
      isFinalized: auction.isFinalized
    };
    debugInfo.steps.push("✅ Subasta encontrada");

    // Paso 2: Probar conexión al bid-service
    debugInfo.steps.push("2. Probando conexión al bid-service...");
    
    try {
      const token = req.header('Authorization');
      // ✅ CORRECCIÓN: URL sin /api
      const bidServiceUrl = `${process.env.BID_SERVICE_URL}/bids/history/${auctionId}`;
      
      debugInfo.requestDetails = {
        url: bidServiceUrl,
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + "..." : null
      };
      
      console.log(`📡 Haciendo request a: ${bidServiceUrl}`);
      
      const response = await axios.get(bidServiceUrl, {
        timeout: 5000,
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { Authorization: token })
        }
      });

      debugInfo.steps.push("✅ Conexión exitosa al bid-service");
      debugInfo.bidServiceResponse = {
        status: response.status,
        data: response.data
      };

      // Paso 3: Analizar la respuesta
      debugInfo.steps.push("3. Analizando respuesta del bid-service...");
      
      const bidHistory = response.data;
      debugInfo.analysis = {
        hasBidHistory: !!bidHistory,
        bidCount: bidHistory?.bidCount || 0,
        highestBid: bidHistory?.highestBid || 0,
        highestBidder: bidHistory?.highestBidder || null,
        lastUpdated: bidHistory?.lastUpdated || null
      };

      if (bidHistory && bidHistory.highestBidder && bidHistory.highestBid) {
        debugInfo.steps.push("✅ Ganador encontrado en el historial");
        debugInfo.winner = {
          bidderId: bidHistory.highestBidder,
          bidAmount: bidHistory.highestBid
        };
      } else {
        debugInfo.steps.push("❌ No se encontró ganador en el historial");
      }

    } catch (bidServiceError) {
      debugInfo.steps.push("❌ Error conectando al bid-service");
      debugInfo.bidServiceError = {
        message: bidServiceError.message,
        code: bidServiceError.code,
        status: bidServiceError.response?.status,
        data: bidServiceError.response?.data
      };
    }

    res.json({
      success: true,
      debug: debugInfo
    });

  } catch (error) {
    console.error('❌ Error en debugBidService:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Función para testear una subasta específica y tratar de finalizarla manualmente
const testFinalizeAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;
    
    console.log(`🧪 Testeando finalización de subasta: ${auctionId}`);
    
    const token = req.header('Authorization');
    
    // Intentar finalizar la subasta
    const result = await finalizeAuction(auctionId, token);
    
    res.json({
      success: true,
      message: "Subasta finalizada exitosamente",
      data: {
        id: result._id,
        title: result.title,
        status: result.status,
        winnerId: result.winnerId,
        winningBid: result.winningBid,
        isFinalized: result.isFinalized
      }
    });

  } catch (error) {
    console.error('❌ Error en testFinalizeAuction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Función para ver todas las pujas directamente desde el bid-service
const getAllBidsForAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const token = req.header('Authorization');
    
    console.log(`📋 Obteniendo todas las pujas para subasta: ${auctionId}`);
    
    try {
      // ✅ CORRECCIÓN: URLs sin /api
      const historyResponse = await axios.get(
        `${process.env.BID_SERVICE_URL}/bids/history/${auctionId}`,
        {
          timeout: 5000,
          headers: { 
            'Content-Type': 'application/json',
            ...(token && { Authorization: token })
          }
        }
      );

      const bidsResponse = await axios.get(
        `${process.env.BID_SERVICE_URL}/bids/auction/${auctionId}`,
        {
          timeout: 5000,
          headers: { 
            'Content-Type': 'application/json',
            ...(token && { Authorization: token })
          }
        }
      );

      res.json({
        success: true,
        data: {
          history: historyResponse.data,
          individualBids: bidsResponse.data
        }
      });

    } catch (bidServiceError) {
      res.json({
        success: false,
        error: "Error conectando al bid-service",
        details: {
          message: bidServiceError.message,
          status: bidServiceError.response?.status,
          data: bidServiceError.response?.data
        }
      });
    }

  } catch (error) {
    console.error('❌ Error en getAllBidsForAuction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


module.exports = {
  createAuction,
  getAuctions,
  getAuctionById,
  updateAuction,
  cancelAuction,
  closeAuction,
  finalizeAuction,
  finalizeExpiredAuctions,
  triggerExpiredAuctionsCheck,
  getAuctionStatus,
  getAuctionWinners,
  getAuctionsByCategory,
  debugBidService,
  testFinalizeAuction,
  getAllBidsForAuction
};