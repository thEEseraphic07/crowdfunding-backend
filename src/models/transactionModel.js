const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign"
  },

  amount: {
    type: Number,
    required: true
  },

  originalAmount: {
    type: Number,
    default: 0
  },

  platformFee: {
    type: Number,
    default: 0
  },

  type: {
    type: String,
    enum: [
      "donation",
      "withdrawal",
      "refund",
      "fee",
      "platform-withdrawal"
    ],
    required: true
  },

  status: {
    type: String,
    enum: [
      "pending",
      "approved",
      "rejected",
      "completed",
      "failed",
      "success"
    ],
    default: "pending"
  },

  bankName: {
    type: String
  },

  accountNumber: {
    type: String
  },

  accountName: {
    type: String
  },

  recipientCode: {
    type: String
  },

  transferReference: {
    type: String
  },

  reference: String

}, {
  timestamps: true
});

transactionSchema.index(
  { reference: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "donation" } }
);

module.exports = mongoose.model("Transaction", transactionSchema);
