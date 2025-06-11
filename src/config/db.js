const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔄 Intentando conectar a MongoDB...');
    console.log(`🔗 URI: ${process.env.MONGODB_URI}`);
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conexión a MongoDB establecida');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

module.exports = connectDB;