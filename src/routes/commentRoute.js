const express = require("express");

const router = express.Router();

const {
  createComment,
  getComments
} = require("../controllers/commentController");

const {
  protect
} = require("../middleware/authMiddleware");

router.get("/:campaignId", getComments);

router.post(
  "/:campaignId",
  protect,
  createComment
);

module.exports = router;