const mongoose = require("mongoose");

const platformEarningsSchema = new mongoose.Schema({
  total: { type: Number, default: 0 },
  donations: { type: Number, default: 0 },
  withdrawals: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("PlatformEarnings", platformEarningsSchema);