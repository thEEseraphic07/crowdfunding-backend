const express = require('express');
const protect = require('../middleware/authMiddleware');
const { getMyDonations } = require('../controllers/donationController');

const router = express.Router();

router.get('/my-donations', protect, getMyDonations);

module.exports = router;
