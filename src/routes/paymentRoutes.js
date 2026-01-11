const express = require ('express');
const { initializePayment } = require ('../controllers/paymentController')
const protect = require ('../middleware/authMiddleware')

const router = express.Router();

router.post('/initialize', protect, initializePayment);

module.exports = router