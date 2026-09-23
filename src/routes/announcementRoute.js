const express = require("express");

const router = express.Router();

const {

    createAnnouncement,

    getAnnouncements,

    updateAnnouncement,

    deleteAnnouncement,

    publishAnnouncement,

    unpublishAnnouncement,

    getPublishedAnnouncements

} = require("../controllers/announcementController");

const {

    protect,

    adminOnly

} = require("../middleware/authMiddleware");

router.post("/", protect, adminOnly, createAnnouncement);

router.get("/", protect, adminOnly, getAnnouncements);

router.get("/public", getPublishedAnnouncements);

router.patch("/:id", protect, adminOnly, updateAnnouncement);

router.delete("/:id", protect, adminOnly, deleteAnnouncement);

router.patch("/:id/publish", protect, adminOnly, publishAnnouncement);

router.patch("/:id/unpublish", protect, adminOnly, unpublishAnnouncement);

module.exports = router;