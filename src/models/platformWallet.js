const mongoose = require("mongoose");

const platformWalletSchema = new mongoose.Schema({

  key: {
    type: String,
    unique: true,
    default: "main"
  },

  balance: {
    type: Number,
    default: 0
  },

  transactions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction"
    }
  ]

}, {
  timestamps: true
});

module.exports = mongoose.model("PlatformWallet", platformWalletSchema);