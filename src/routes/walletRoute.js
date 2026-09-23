const express = require('express');
const router = express.Router();
const { getWallet } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getWallet);

module.exports = router;