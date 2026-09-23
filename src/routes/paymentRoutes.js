const express = require ('express');
const { protect } = require ('../middleware/authMiddleware')

const { 
 initializePayment, 
 verifyPayment
} = require ('../controllers/paymentController');

const router = express.Router();

router.post('/initialize', protect, initializePayment);
router.get("/verify/:reference", protect, verifyPayment);

module.exports = router;