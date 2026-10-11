const mongoose = require("mongoose");
const Transaction = require("../models/transactionModel");
const createNotification = require("../utils/createNotification");
const User = require("../models/userModel");
const axios = require("axios");
                                        
exports.getBanks = async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.paystack.co/bank",
      {
        params: {
          country: "nigeria"
        },
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    res.json(response.data.data);

  } catch (error) {
    console.error(
      "Get banks error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      message: "Unable to load banks"
    });
  }
};


exports.resolveBankAccount = async (req, res) => {
  try {
    const { account_number, bank_code } = req.query;

    if (!account_number || !bank_code) {
      return res.status(400).json({
        message: "Account number and bank code are required"
      });
    }

    const response = await axios.get(
      "https://api.paystack.co/bank/resolve",
      {
        params: {
          account_number,
          bank_code
        },
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    res.json(response.data.data);

  } catch (error) {
    console.error(
      "Resolve account error:",
      error.response?.data || error.message
    );

    res.status(400).json({
      message:
        error.response?.data?.message ||
        "Unable to verify bank account"
    });
  }
};

exports.createTransferRecipient = async ({
  name,
  accountNumber,
  bankCode
}) => {
  try {
    const response = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type: "nuban",
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.data;

  } catch (error) {
    console.error(
      "Create transfer recipient error:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.message ||
      "Unable to create transfer recipient"
    );
  }
};

exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, bankName, bankCode, accountNumber, accountName } = req.body;

    const withdrawalAmount = Number(amount);

    if (!withdrawalAmount || withdrawalAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    if (!bankName || !bankCode || !accountNumber || !accountName) {
      return res.status(400).json({ message: "Complete bank details required" });
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

    const recipient = await exports.createTransferRecipient({
      name: accountName,
      accountNumber,
      bankCode
    });

    const reference = `wd-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const withdrawal = await Transaction.create({
      user: user._id,
      amount: withdrawalAmount,
      type: "withdrawal",
      status: "pending",
      reference,
      bankName,
      bankCode,
      accountNumber,
      accountName,
      recipientCode: recipient.recipient_code
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

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal not found"
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        message: "Withdrawal has already been processed"
      });
    }

    const io = req.app.get("io");

    withdrawal.status = "rejected";

    await withdrawal.save();

    try {
      await createNotification({
        io,
        user: withdrawal.user,
        title: "Withdrawal Rejected",
        message: `Your ₦${withdrawal.amount} withdrawal request was rejected.`,
        type: "withdrawal"
      });
    } catch (notificationError) {
      console.error(
        "Withdrawal notification error:",
        notificationError
      );
    }

    try {
      io.to(withdrawal.user.toString()).emit(
        "withdrawalRejected",
        {
          amount: withdrawal.amount,
          status: "rejected"
        }
      );
    } catch (socketError) {
      console.error(
        "Withdrawal socket error:",
        socketError
      );
    }

    return res.json({
      message: "Withdrawal rejected successfully",
      withdrawal
    });

  } catch (err) {
    console.error("Withdrawal rejection error:", err);

    return res.status(500).json({
      message: "Withdrawal rejection failed"
    });
  }
};


exports.initiateTransfer = async ({
  amount,
  recipientCode,
  reference
}) => {
  const payload = {
    source: "balance",
    amount: Math.round(Number(amount) * 100),
    recipient: recipientCode,
    reason: "CrowdFund withdrawal",
    reference
  };

  console.log("=== TRANSFER DEBUG ===");
  console.log("Reference:", JSON.stringify(payload.reference));
  console.log("Reference length:", payload.reference?.length);
  console.log(
    "Reference valid:",
    typeof payload.reference === "string" &&
      /^[a-z0-9_-]{16,50}$/.test(payload.reference)
  );
  console.log("Amount in kobo:", payload.amount);
  console.log("Recipient present:", Boolean(payload.recipient));

  try {
    const response = await axios.post(
      "https://api.paystack.co/transfer",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.data;
  } catch (error) {
    console.error("Paystack HTTP status:", error.response?.status);
    console.error(
      "Paystack response:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.message ||
      "Unable to initiate transfer"
    );
  }
};

exports.approveWithdrawal = async (req, res) => {
  let session;
  let transfer;

  try {
    const { id } = req.params;

    const withdrawal = await Transaction.findById(id);

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal not found"
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        message: "Already processed"
      });
    }

    if (!withdrawal.recipientCode) {
      return res.status(400).json({
        message: "Transfer recipient not found"
      });
    }

    const user = await User.findById(withdrawal.user);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.walletBalance < withdrawal.amount) {
      return res.status(400).json({
        message: "Insufficient user balance"
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: withdrawal.user,
        walletBalance: { $gte: withdrawal.amount }
      },
      {
        $inc: {
          walletBalance: -withdrawal.amount
        }
      },
      {
        new: true,
        session
      }
    );

    if (!updatedUser) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        message: "Insufficient user balance"
      });
    }

    withdrawal.status = "approved";
    withdrawal.transferReference = withdrawal.reference;

    await withdrawal.save({ session });

    await session.commitTransaction();
    session.endSession();

    try{
      transfer = await exports.initiateTransfer({
        amount: withdrawal.amount,
        recipientCode: withdrawal.recipientCode,
        reference: withdrawal.reference
      });
    }catch(transferError){
      const refundSession = await mongoose.startSession();

      try{
        refundSession.startTransaction();

        await User.findByIdAndUpdate(
          withdrawal.user,{
            $inc: {
              walletBalance: withdrawal.amount
            }
          },
          {
            session: refundSession
          }
        );
        withdrawal.status = "pending";
        withdrawal.transferReference = undefined;

        await withdrawal.save({ session: refundSession });
        await refundSession.commitTransaction();
      }catch(refundError){
        await refundSession.abortTransaction();
        console.error("Withdrawal refund error:", refundError)
      }finally{
        refundSession.endSession();
      }
      throw transferError;
    }

    const io = req.app.get("io");

    try {
      await createNotification({
        io,
        user: withdrawal.user,
        title: "Withdrawal Approved", 
        message: `₦${withdrawal.amount} withdrawal has been approved`,
        type: "withdrawal"
      });
    } catch (err) {
      console.error("Notification error:", err);
    }

    try {
      io.to(withdrawal.user.toString()).emit(
        "withdrawalApproved",
        {
          amount: withdrawal.amount,
          status: "approved"
        }
      );
    } catch (socketErr) {
      console.error("Socket error:", socketErr);
    }

    return res.json({
      message: "Withdrawal approved and transfer initiated",
      withdrawal,
      transfer
    });

  } catch (err) {

    if (session) {
      try {
        await session.abortTransaction();
      } catch (e) {}

      session.endSession();
    }

    console.error("Withdrawal approval error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Withdrawal approved failed"
     });
  }
};