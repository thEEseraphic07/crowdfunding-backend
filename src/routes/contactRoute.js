const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const { sendContactMessage, getAllContactMessages, markMessageRead, deleteContactMessage, replyToContactMessage } = require("../controllers/contactController");

const contactMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many contact messages, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/", contactMessageLimiter, sendContactMessage);
router.get("/", protect, adminOnly, getAllContactMessages);
router.patch("/:id/read", protect, adminOnly, markMessageRead);
router.patch("/:id/reply", protect, adminOnly, replyToContactMessage);
router.delete("/:id", protect, adminOnly, deleteContactMessage);


module.exports = router;