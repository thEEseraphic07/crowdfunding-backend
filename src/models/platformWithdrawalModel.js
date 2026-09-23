const mongoose = require("mongoose");

const platformWithdrawalSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },

  bankName: {
    type: String,
    required: true
  },

  accountNumber: {
    type: String,
    required: true
  },

  accountName: {
    type: String,
    required: true
  },

  reference: String,

  status: {
    type: String,
    enum: [
      "pending",
      "processing",
      "completed",
      "failed"
    ],
    default: "pending"
  },

  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }

}, {
  timestamps: true
});

module.exports = mongoose.model("PlatformWithdrawal", platformWithdrawalSchema);