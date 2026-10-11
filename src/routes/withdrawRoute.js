const express = require('express');
const router = express.Router();

const {
  requestWithdrawal,
  approveWithdrawal,
  getWithdrawals,
  rejectWithdrawal,
  getBanks,
  resolveBankAccount
} = require('../controllers/withdrawController');

const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/', protect, requestWithdrawal);
router.post('/:id/approve', protect, adminOnly, approveWithdrawal);
router.get('/', protect, adminOnly, getWithdrawals);
router.post('/:id/reject', protect, adminOnly, rejectWithdrawal);
router.get('/banks', protect, getBanks);
router.get('/resolve-account', protect, resolveBankAccount);

module.exports = router;