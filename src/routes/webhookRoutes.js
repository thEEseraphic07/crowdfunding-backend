const express = require ('express');
const router = express.Router();
const { paystackWebhook } = require ('../controllers/webhookController');

router.post('/paystack', express.raw({type: 'application/json'}),
paystackWebhook
);

module.exports = router;