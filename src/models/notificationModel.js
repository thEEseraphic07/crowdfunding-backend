const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    audience: {
      type: String,
      enum : ["admin", "user"],
      default: "user"
    },

    title: {
      type: String,
      required: true
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["user", "campaign_ended", "system", "info", "donation", "withdrawal", "admin_action"],
      default: "info"
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);