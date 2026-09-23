const express = require("express");

const router = express.Router();

const { protect, adminOnly } = require("../middleware/authMiddleware");

const {
    getSettings,
    updateSettings
} = require("../controllers/settingsController");

router.get("/", getSettings);

router.put("/", protect, adminOnly, updateSettings);

module.exports = router;