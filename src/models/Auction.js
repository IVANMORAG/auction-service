const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  startPrice: { type: Number, required: true, min: 0 },
  currentPrice: { type: Number, default: 0 },
  endTime: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['active', 'closed', 'cancelled'], 
    default: 'active' 
  },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winningBid: { type: Number },
  isFinalized: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, {
  // Eliminar campos duplicados y versionKey
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});
module.exports = mongoose.model('Auction', auctionSchema);