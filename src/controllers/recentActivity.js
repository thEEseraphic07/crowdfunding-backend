const Transaction = require("../models/transactionModel");
const Notification = require("../models/notificationModel");

exports.getRecentActivity = async (req, res) => {
  try {
    const userId = req.user._id;

    // recent transactions
    const transactions = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    const activity = [];

    transactions.forEach(t => {
      activity.push({
        type: "transaction",
        title: `${t.type.toUpperCase()}`,
        message: `₦${t.amount} - ${t.status}`,
        time: t.createdAt
      });
    });

    notifications.forEach(n => {
      activity.push({
        type: "notification",
        title: n.title,
        message: n.message,
        time: n.createdAt
      });
    });

    // sort everything together
    activity.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json(activity.slice(0, 10));

  } catch (err) {
    console.error("Activity error:", err);
    res.status(500).json({ message: "Failed to load activity" });
  }
};