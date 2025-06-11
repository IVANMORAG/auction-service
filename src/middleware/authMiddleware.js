const axios = require('axios');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const response = await axios.get(
      `${process.env.AUTH_SERVICE_URL}/api/auth/validate-token`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Verificar que la respuesta sea exitosa
    if (!response.data.success || !response.data.data.user) {
      throw new Error('Usuario no encontrado en la respuesta de validación');
    }

    // Asignar solo la información del usuario
    req.user = response.data.data.user;
    next();
    
  } catch (error) {
    logger.error('Error validando token:', error.message);
    res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = authMiddleware;