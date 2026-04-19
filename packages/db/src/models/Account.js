const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    accountNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    type: {
      type: String,
      enum: ['CHECKING', 'SAVINGS', 'LOAN'],
      default: 'CHECKING',
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Account || mongoose.model('Account', accountSchema);
