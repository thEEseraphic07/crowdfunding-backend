const express = require('express');
const { registerUser, loginUser, forgotPassword, resetPassword } = require('../controllers/authController');
const protect = require('../middleware/authMiddleware'); // keep for profile route

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected route
router.get('/profile', protect, (req, res) => {
  res.json(req.user);
});

module.exports = router;
