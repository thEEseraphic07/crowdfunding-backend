const express = require('express');
const {
  registerUser,
  loginUser,
  verify2FA,
  resendOTP,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  uploadPhoto,
  removePhoto,
  resendVerificationEmail
} = require('../controllers/authController');

const { protect, adminOnly } = require('../middleware/authMiddleware');

const rateLimit = require("express-rate-limit");

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many registration attempts, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many OTP requests, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many password reset requests, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    message: "Too many reset attempts, try again later"
  }
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    message: "Too many requests, try again later"
  }
});

const updateProfileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    message: "Too many profile update requests, please try again later"
  }
});


router.post('/register', registerLimiter, registerUser);
router.post('/login', loginLimiter, loginUser);
router.post('/resend-verification', resendLimiter, resendVerificationEmail);

router.get("/verify-email/:token", verifyEmail);

router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

router.get('/me', protect, getMe);
router.put("/update", protect, updateProfileLimiter, updateProfile);
router.put("/upload-photo", protect, uploadPhoto);
router.delete("/remove-photo", protect, removePhoto);
router.post("/verify-2fa", otpLimiter, verify2FA);
router.post("/resend-otp", otpLimiter, resendOTP);

module.exports = router;