const Notification = require("../models/notificationModel");

exports.getNotifications = async (req, res) => {
  try{
    let query = {};
    if(req.user.isAdmin){
      query = {
        audience: "admin",
        isDeleted: false
      };
    }else{
      query = {
        user: req.user._id,
        audience: "user",
        isDeleted: false
      };
    }

    const notifications = await Notification.find(query)
    .sort({ createdAt: -1 });
    res.json(notifications);
  }catch(err){
    console.error(err);
    res.status(500).json({
      message: "Failed to load notifications"
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    let query = {
      _id: req.params.id,
      isDeleted: false
    };

    if (req.user.isAdmin) {
      query.audience = "admin";
    } else {
      query.user = req.user._id;
      query.audience = "user";
    }

    const notif = await Notification.findOne(query);

    if (!notif) {
      return res.status(404).json({ message: "Not found" });
    }

    notif.isRead = true;
    await notif.save();

    res.json({ message: "Marked as read" });

  } catch (err) {
    res.status(500).json({
      message: "Error updating notification"
    });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {

    let query = {};

    if (req.user.isAdmin) {
      query = {
        audience: "admin",
        isDeleted: false,
        isRead: false
      };
    } else {
      query = {
        user: req.user._id,
        audience: "user",
        isDeleted: false,
        isRead: false
      };
    }

    console.log("Query:", query);

    const result = await Notification.updateMany(
      query,
      {
        $set: {
          isRead: true
        }
      }
    );

    console.log(result);

    res.json({
      message: "All marked as read"
    });

  } catch (err) {
    res.status(500).json({
      message: "Failed to update notifications"
    });
  }
};  

exports.deleteNotification = async (req, res) => {
  try {
    let query = {
      _id: req.params.id
    };

    if (req.user.isAdmin) {
      query.audience = "admin";
    } else {
      query.user = req.user._id;
      query.audience = "user";
    }

    const notif = await Notification.findOneAndDelete(query);

    if (!notif) {
      return res.status(404).json({
        message: "Notification not found"
      });
    }

    res.json({
      message: "Notification deleted"
    });

  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Error deleting notification"
    });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    let query = {
      isRead: false,
      isDeleted: false
    };

    if (req.user.isAdmin) {
      query.audience = "admin";
    } else {
      query.user = req.user._id;
      query.audience = "user";
    }

    const count = await Notification.countDocuments(query);

    res.json({ count });

  } catch (err) {
    res.status(500).json({
      message: "Failed to get count"
    });
  }
};