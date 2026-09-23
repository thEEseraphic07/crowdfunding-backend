const mongoose = require("mongoose");
const Transaction = require("../models/transactionModel");
const createNotification = require("../utils/createNotification");
const User = require("../models/userModel");

exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, bankName, accountNumber } = req.body;

    const withdrawalAmount = Number(amount);

    if (!withdrawalAmount || withdrawalAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    if (!bankName || !accountNumber) {
      return res.status(400).json({ message: "Bank details required" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pendingWithdrawals = await Transaction.aggregate([
      {
        $match: {
          user: user._id,
          type: "withdrawal",
          status: "pending"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount"}
        }
      }
    ]);

    const pendingAmount = pendingWithdrawals[0]?.total || 0;

    const availableBalance = Number(user.walletBalance) - Number(pendingAmount);

    if(withdrawalAmount > availableBalance){
      return res.status(400).json({
        message: "Insufficient balance"
      });
    }

    const reference = `WD-${Date.now()}`;

    const withdrawal = await Transaction.create({
      user: user._id,
      amount: withdrawalAmount,
      type: "withdrawal",
      status: "pending",
      reference,
      bankName,
      accountNumber
    });

    const io = req.app.get("io");

    const admins = await User.find({ role: "admin" });

    for (const admin of admins) {
      await createNotification({
        io,
        user: admin._id,
        audience: "admin",
        title: "New Withdrawal Request",
        message: `A user requested ₦${withdrawalAmount}`,
        type: "withdrawal"
      });
    }

    io.to("admins").emit("adminNotification", {
      message: `New withdrawal request of ₦${withdrawalAmount}`,
      createdAt: new Date()
    });

    return res.json({
      message: "Withdrawal request submitted",
      reference
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Withdrawal failed" });
  }
};

exports.getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Transaction.find({ type: "withdrawal" })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;

    const withdrawal = await Transaction.findById(id);

    if (!withdrawal || withdrawal.status !== "pending") {
      return res.status(400).json({ message: "Invalid request" });
    }

    const io = req.app.get("io");

    withdrawal.status = "rejected";
    await withdrawal.save();

    await createNotification({
      io,
      user: withdrawal.user,
      title: "Withdrawal Rejected",
      message: `₦${withdrawal.amount} rejected`,
      type: "withdrawal",
    });

    res.json({ message: "Rejected", withdrawal });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveWithdrawal = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { id } = req.params;

    const withdrawal = await Transaction.findById(id).session(session);

    if (!withdrawal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    if (withdrawal.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Already processed" });
    }

    const user = await User.findById(withdrawal.user).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User not found" });
    }

    if (user.walletBalance < withdrawal.amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Insufficient user balance" });
    }

    user.walletBalance -= withdrawal.amount;
    await user.save({ session });

    withdrawal.status = "approved";
    await withdrawal.save({ session });

    await session.commitTransaction();
    session.endSession();

    const io = req.app.get("io");

    try{
      await createNotification({
      io,
      user: withdrawal.user,
      title: "Withdrawal Approved",
      message: `₦${withdrawal.amount} approved`,
      type: "withdrawal",
      });
    }catch(err){
      console.error("Notification error:", err);
    }

    try{
      io.to(withdrawal.user.toString()).emit("withdrawalApproved", {
      amount: withdrawal.amount,
      status: "approved"
    });
    }catch(socketErr){
      console.error("Socket error:", socketErr);
    }

    return res.json({
      message: "Withdrawal approved",
      withdrawal
    });

  } catch (err) {
    if(session){
      await session.abortTransaction();
      session.endSession();
    }
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};