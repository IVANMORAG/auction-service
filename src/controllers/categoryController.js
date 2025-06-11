const Category = require('../models/Category');
const Auction = require('../models/Auction');
const logger = require('../utils/logger');

// Crear una categoría (Protegido)
const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Validaciones
    if (!name) {
      return res.status(400).json({ 
        error: 'El nombre es requerido',
        success: false 
      });
    }
    
    // Verificar si la categoría ya existe
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ 
        error: 'La categoría ya existe',
        success: false 
      });
    }
    
    const category = new Category({
      name,
      description: description || '',
    });
    
    await category.save();
    logger.info(`Categoría creada: ${category._id}`);
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Categoría creada exitosamente'
    });
  } catch (error) {
    logger.error('Error creando categoría:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Listar todas las categorías (Público)
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Error listando categorías:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Obtener categoría por ID (Público)
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ 
        error: 'Categoría no encontrada',
        success: false 
      });
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error('Error obteniendo categoría:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Actualizar categoría (Protegido)
const updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ 
        error: 'Categoría no encontrada',
        success: false 
      });
    }
    
    // Verificar si el nuevo nombre ya existe
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({ 
          error: 'El nombre de la categoría ya existe',
          success: false 
        });
      }
    }
    
    // Actualizar campos
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    
    await category.save();
    logger.info(`Categoría actualizada: ${category._id}`);
    
    res.json({
      success: true,
      data: category,
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    logger.error('Error actualizando categoría:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

// Eliminar categoría (Protegido)
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ 
        error: 'Categoría no encontrada',
        success: false 
      });
    }
    
    // Verificar si hay subastas asociadas
    const auctions = await Auction.find({ categoryId: req.params.id });
    if (auctions.length > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la categoría porque tiene subastas asociadas',
        success: false 
      });
    }
    
    await category.deleteOne();
    logger.info(`Categoría eliminada: ${category._id}`);
    
    res.json({
      success: true,
      message: 'Categoría eliminada exitosamente'
    });
  } catch (error) {
    logger.error('Error eliminando categoría:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      success: false 
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};