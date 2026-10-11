const express = require("express");
const router = express.Router();

const { protect, adminOnly } = require("../middleware/authMiddleware");

const adminController = require("../controllers/adminController");

const {
  getAdminStats,
  getAllUsers,
  getAllCampaigns,
  deleteUser,
  getAllDonations,
  toggleSuspendUser,
  deleteCampaignAdmin,
  flagUser,
  getPlatformEarnings,
  getPlatformWallet,
  getBanks,
  resolveAccount,
  approveCampaign
} = require("../controllers/adminController");

const {
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
} = require("../controllers/withdrawController");

const {
  flagCampaign,
  endCampaign,
  unflagCampaign
} = require("../controllers/campaignController");

router.post('/resolve-account', protect, adminOnly, resolveAccount);
router.post('/withdrawals/approve', protect, adminOnly, approveWithdrawal);
router.get('/withdrawals', protect, adminOnly, getWithdrawals);
router.post('/withdrawals/reject', protect, adminOnly, rejectWithdrawal);
router.post("/platform-withdraw", protect, adminOnly, adminController.requestPlatformWithdrawal);

router.get('/banks', protect, adminOnly, adminController.getBanks);
router.get("/platform-withdrawals", protect, adminOnly, adminController.getPlatformWithdrawals);
router.get("/stats", protect, adminOnly, getAdminStats);
router.get("/users", protect, adminOnly, getAllUsers);
router.delete("/users/:id", protect, adminOnly, deleteUser);
router.put("/users/:id/suspend", protect, adminOnly, toggleSuspendUser);
router.put("/users/:id/flag", protect, adminOnly, flagUser);

router.get("/campaigns", protect, adminOnly, getAllCampaigns);
router.put("/campaigns/:id/approve", protect, adminOnly, approveCampaign);
router.delete("/campaigns/:id", protect, adminOnly, deleteCampaignAdmin);
router.put("/campaigns/:id/flag", protect, adminOnly, flagCampaign);
router.put("/campaigns/:id/end", protect, adminOnly, endCampaign);
router.put("/campaigns/:id/unflag", protect, adminOnly, unflagCampaign);

router.get("/donations", protect, adminOnly, getAllDonations);

router.get("/earnings", protect, adminOnly, getPlatformEarnings);
router.get("/platform-wallet", protect, adminOnly, adminController.getPlatformWallet);

router.get('/transactions', protect, adminOnly, async (req, res) => {
  const Transaction = require('../models/transactionModel');

  const transactions = await Transaction.find()
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.json(transactions);
});

module.exports = router;