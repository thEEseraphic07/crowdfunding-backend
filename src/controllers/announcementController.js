const Announcement = require("../models/announcementModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");

exports.createAnnouncement = async (req, res) => {

    try {

        const {
            title,
            message,
            expiresAt
        } = req.body;

        if (!title || !message) {

            return res.status(400).json({
                message: "Title and message are required."
            });

        }

        const announcement = await Announcement.create({

            title,
            message,
            expiresAt,
            createdBy: req.user.id,
            published: false
        });

        res.status(201).json({

            message: "Announcement saved as draft.",

            announcement

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            message: "Unable to create announcement."

        });

    }

};

exports.getAnnouncements = async (req, res) => {

    try {

        const announcements = await Announcement.find()

            .populate("createdBy", "fullName email")

            .sort({ createdAt: -1 });

        res.json(announcements);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            message: "Unable to fetch announcements."

        });

    }

};

exports.updateAnnouncement = async (req, res) => {

    try {

        const announcement = await Announcement.findByIdAndUpdate(

            req.params.id,

            req.body,

            { new: true }

        );

        if (!announcement) {

            return res.status(404).json({

                message: "Announcement not found."

            });

        }

        res.json({

            message: "Announcement updated successfully.",

            announcement

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            message: "Unable to update announcement."

        });

    }

};

exports.deleteAnnouncement = async (req, res) => {

    try {

        const announcement = await Announcement.findByIdAndDelete(

            req.params.id

        );

        if (!announcement) {

            return res.status(404).json({

                message: "Announcement not found."

            });

        }

        res.json({

            message: "Announcement deleted successfully."

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            message: "Unable to delete announcement."

        });

    }

};

exports.publishAnnouncement = async (req, res) => {

    try {

        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {

            return res.status(404).json({
                message: "Announcement not found."
            });

        }

        if (announcement.published) {

            return res.status(400).json({
                message: "Announcement is already published."
            });

        }

        announcement.published = true;

        await announcement.save();

        const users = await User.find({}, "_id");

        const notifications = users.map(user => ({

            user: user._id,

            audience: "user",

            title: announcement.title,

            message: announcement.message,

            type: "info"

        }));

        await Notification.insertMany(notifications);

        res.json({

            message: "Announcement published successfully.",

            announcement

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            message: "Unable to publish announcement."

        });

    }

};

exports.unpublishAnnouncement = async (req, res) => {

    const announcement = await Announcement.findByIdAndUpdate(

        req.params.id,

        { published: false },

        { new: true }

    );

    res.json(announcement);

};

exports.getPublishedAnnouncements = async (req, res) => {
    try {

        const announcements = await Announcement.find({
            published: true,
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        })
        .sort({ createdAt: -1 });

        res.json(announcements);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Unable to load announcements."
        });

    }
};

