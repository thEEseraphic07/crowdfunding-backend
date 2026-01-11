const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    targetAmount: { type: Number, required: true, min: 0 },
    currentAmount: { type: Number, default: 0, min: 0 },
    category: {
      type: String,
      required: true,
      enum: ["Medical", "Education", "Business", "Emergency", "Charity", "Other"],
    },
    donations: [
        {
            user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
            amount: {type: Number, required: true, min: 1},
            donatedAt: {type: Date, default: Date.now},
        }
    ],
    deadline: { type: Date, required: true },
    image: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CampaignSchema.pre('save', async function() {
  if (this.deadline < new Date()) {
    this.isActive = false;
  }
});

module.exports = mongoose.model('Campaign', CampaignSchema);
