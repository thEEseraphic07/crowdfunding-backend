const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      minlength: 8
    },

    bio: {
      type: String,
      default: ""
    },

    profileImage: {
      type: String,
      default: ""
    },

    savedCampaigns: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign"
    }],

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },

    isAdmin: {
      type: Boolean,
      default: false
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    isSuspended: {
      type: Boolean,
      default: false
    },

    isFlagged: {
      type: Boolean,
      default: false
    },

    verificationToken: {
      type: String,
      select: false
    },

    verificationTokenExpire: {
      type: Date
    },

    resetToken: {
      type: String,
      select: false
    },

    resetTokenExpire: {
      type: Date
    },

    otpResendAttempts: {
      type: Number,
      default: 0
    },

    otpResendBlockedUntil: Date,

    failedLoginAttempts: {
      type: Number,
      default: 0
    },

    lockUntil: {
      type: Date,
      default: null
    },

    walletBalance: {
      type: Number,
      default: 0
    },

    twoFactorEnabled: {
      type: Boolean,
      default: true
    },

    twoFactorCode: {
      type: String,
      default: null
    },

    twoFactorExpires: {
      type: Date,
      default: null
    }

  },

  {
    timestamps: true,
    autoIndex: false
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(
    enteredPassword,
    this.password
  );
};

userSchema.methods.getResetToken = function () {

  const resetToken =
    crypto.randomBytes(20).toString('hex');

  this.resetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.resetTokenExpire =
    Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', userSchema);