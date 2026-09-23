const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({

    platformName: {
        type: String,
        default: "CrowdFund Pro"
    },

    platformFee: {
        type: Number,
        default: 5
    },

    enable2FA: {
        type: Boolean,
        default: false
    },

    emailVerification: {
        type: Boolean,
        default: true
    },

    currency: {
        type: String,
        default: "USD"
    },

    minGoal: {
        type: Number,
        default: 100
    },

    maxGoal: {
        type: Number,
        default: 100000
    },

    maxDuration: {
        type: Number,
        default: 90
    },

    autoApproveCampaigns: {
        type: Boolean,
        default: false
    },

    maintenanceMode: {
        type: Boolean,
        default: false
    },

    guestDonations: {
        type: Boolean,
        default: true
    },

    campaignCategories: [{
        type: String
    }],

    minWithdrawal: {
        type: Number,
        default: 50
    },

    withdrawalFee: {
        type: Number,
        default: 2
    },

    payoutDelay: {
        type: Number,
        default: 7
    }

}, { timestamps: true });

module.exports = mongoose.model("Settings", settingsSchema);