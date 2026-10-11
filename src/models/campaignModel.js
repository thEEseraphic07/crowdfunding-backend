const mongoose = require ('mongoose');
const CampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    targetAmount: { type: Number, required: true, min: 0 },
    currentAmount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["active", "pending", "flagged", "ended"],
      default: "active"
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },
    
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    donations: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        amount: { type: Number, required: true, min: 1 },
        donatedAt: { type: Date, default: Date.now },
      }
    ],

    isApproved: {
      type: Boolean,
      default: false
    },
    
    isFlagged: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    deadline: { type: Date, required: true },
    image: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Campaign', CampaignSchema);
