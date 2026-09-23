const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");

exports.getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 });

    const available = user.walletBalance
    
    const withdrawn = transactions
      .filter(t => t.type === "withdrawal" && t.status === "approved")
      .reduce((sum, t) => sum + t.amount, 0);

    const pending = transactions
      .filter(t => t.type === "withdrawal" && t.status === "pending")
      .reduce((sum, t) => sum + t.amount, 0);

    res.json({
      balance: user.walletBalance,
      available,
      pending,
      withdrawn,
      transactions
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};