const express = require ('express');
const { getRecentActivity } = require ("../controllers/recentActivity")
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getRecentActivity);

module.exports = router