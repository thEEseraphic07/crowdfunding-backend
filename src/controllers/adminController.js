const mongoose = require("mongoose");
const User = require("../models/userModel");
const Campaign = require("../models/campaignModel");
const Donation = require("../models/donationModel");
const Transaction = require("../models/transactionModel");
const createNotification = require("../utils/createNotification");
const PlatformWallet = require("../models/platformWallet");
const PlatformWithdrawal = require("../models/platformWithdrawalModel");
const axios = require ("axios");

exports.getAdminStats = async (req, res) => {
  try {
    const now = new Date();

    
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    
    const donations = await Donation.find({
      status: "success"
    }).populate("user");

    const totalRaised = donations.reduce((sum, d) => sum + d.amount, 0);

    
    const thisMonthDonations = await Donation.find({
      status: "success",
      createdAt: { $gte: startOfThisMonth }
    }).populate("user");
    
    const lastMonthDonations = await Donation.find({
      status: "success",
      createdAt: {
        $gte: startOfLastMonth,
        $lt: startOfThisMonth
      }
    }).populate("user");

    const thisMonthTotal = thisMonthDonations.reduce((sum, d) => sum + d.amount, 0);
    const lastMonthTotal = lastMonthDonations.reduce((sum, d) => sum + d.amount, 0);

    const platformGrowth =
      lastMonthTotal === 0
        ? 100
        : Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);

  
    const thisMonthUsers = await User.countDocuments({
      createdAt: { $gte: startOfThisMonth }
    });

    const previousMonthUsers = await User.countDocuments({
      createdAt: {
        $gte: startOfLastMonth,
        $lt: startOfThisMonth
      }
    });

    const userGrowth =
      previousMonthUsers === 0
        ? 100
        : ((thisMonthUsers - previousMonthUsers) / previousMonthUsers) * 100;

  
    const thisMonthCampaigns = await Campaign.countDocuments({
      createdAt: { $gte: startOfThisMonth }
    });

    const previousMonthCampaigns = await Campaign.countDocuments({
      createdAt: {
        $gte: startOfLastMonth,
        $lt: startOfThisMonth
      }
    });

    const campaignGrowth =
      previousMonthCampaigns === 0
        ? 100
        : ((thisMonthCampaigns - previousMonthCampaigns) / previousMonthCampaigns) * 100;

    
    const donationGrowth =
      lastMonthDonations.length === 0
        ? 100
        : ((thisMonthDonations.length - lastMonthDonations.length) /
            lastMonthDonations.length) *
          100;

    const successfulDonations = donations.length;

    const failedDonations = await Donation.find({
      status: "failed"
    });

    const totalDonationsCount = successfulDonations + failedDonations.length;

    const successRate =
      totalDonationsCount === 0
        ? 0
        : (successfulDonations / totalDonationsCount) * 100;

    const avgDonation =
      donations.length === 0 ? 0 : totalRaised / donations.length;

    
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5);

    const recentCampaigns = await Campaign.find()
      .populate("owner", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    const recentDonations = await Donation.find({
      status: "success"
    })
      .populate("user", "name email")
      .populate("campaign", "title")
      .sort({ createdAt: -1 })
      .limit(5);

    const activity = [
      ...recentUsers.map(u => ({
        type: "user",
        message: `${u.name} joined CrowdFund`,
        date: u.createdAt
      })),
      ...recentCampaigns.map(c => ({
        type: "campaign",
        message: `${c.owner?.name} created campaign "${c.title}"`,
        date: c.createdAt
      })),
      ...recentDonations.map(d => ({
        type: "donation",
        message: `${d.user?.name} donated ₦${d.amount} to "${d.campaign?.title}"`,
        date: d.createdAt
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const topCampaigns = await Donation.aggregate([
      { $match: { status: "success" } },
      {
        $group: {
          _id: "$campaign",
          totalRaised: { $sum: "$amount" },
          donations: { $sum: 1 }
        }
      },
      { $sort: { totalRaised: -1 } },
      { $limit: 5 }
    ]);

    await Campaign.populate(topCampaigns, {
      path: "_id",
      select: "title"
    });

    const topDonors = await Donation.aggregate([
      { $match: { status: "success" } },
      {
        $group: {
          _id: "$user",
          totalDonated: { $sum: "$amount" },
          donations: { $sum: 1 }
        }
      },
      { $sort: { totalDonated: -1 } },
      { $limit: 5 }
    ]);

    await User.populate(topDonors, {
      path: "_id",
      select: "name email"
    });

    const users = await User.find();
    const campaigns = await Campaign.find()
    .populate("owner", "name email")
    .lean();

    for(let c of campaigns){
      const donors = await Donation.countDocuments({
        campaign: c._id,
        status: "success"
      });
      c.donorCount = donors;
    }

    const withdrawals = await Transaction.find({
      type: "withdrawal"
    })
    .populate("user", "name email")
    .sort({ createdAt: -1 });

    const pendingWithdrawals = withdrawals.filter(
      w => w.status === "pending"
    );

    const activeCampaigns = campaigns.filter(c => c.status === "active").length;

    const donors = new Set(
      donations
      .filter(d => d.user?._id)
      .map(d => d.user._id.toString())
    ).size;

    const pendingWithdrawalList = withdrawals.filter(
      w => w.status === "pending"
    );

    const pendingCampaigns = campaigns.filter(
     c => c.status === "pending"
    ).length;

const pendingApprovals =
  pendingCampaigns + pendingWithdrawalList.length;

    const wallet = await PlatformWallet.findOne({ key: "main" });
    const platformProfit = wallet?.balance || 0;

    const donationTransactions = await Transaction.find({
      type: "donation",
      status: "success"
    });

    const totalPlatformFees = donationTransactions.reduce((sum, tx) => sum +( tx.platformFee || 0),0);

    const thisMonthRevenue = donationTransactions
    .filter(tx => tx.createdAt >= startOfThisMonth)
    .reduce((sum, tx) => sum + tx.platformFee, 0);

    const lastMonthRevenue = donationTransactions
    .filter(
      tx => tx.createdAt >= startOfLastMonth && tx.createdAt < startOfThisMonth)
    .reduce((sum, tx) => sum + tx.platformFee, 0);

    const monthlyRevenue = [];
    for(let i = 11; i >= 0; i--){
      const start = new Date(
        now.getFullYear(),
        now.getMonth() -i,
        1
      );

      const end = new Date(
        now.getFullYear(),
        now.getMonth() -i + 1,
        1
      );

      const total = donationTransactions
      .filter(tx =>
        tx.createdAt >= start &&
        tx.createdAt < end
      )
      .reduce((sum, tx) => sum + tx.platformFee, 0);

      monthlyRevenue.push({
        month: start.toLocaleString("default", {
          month: "short"
        }),
        total
      });
    }

    const summary = {
      totalUsers: users.length,
      totalCampaigns: campaigns.length,
      totalRaised,
      platformProfit,
      successRate
    };

    res.json({
      stats: {
        totalUsers: users.length,
        totalDonors: donors,
        totalCampaigns: campaigns.length,
        activeCampaigns,
        totalDonations: donations.length,
        totalRaised,
        platformProfit,
        pendingApprovals,
        platformGrowth
      },
      pendingWithdrawals: pendingWithdrawalList,
      growth: {
        userGrowth,
        campaignGrowth,
        donationGrowth
      },
      platformHealth: {
        successRate,
        avgDonation,
        failedDonations: failedDonations.length,

        revenue: {
          walletBalance: platformProfit,
          totalFees: totalPlatformFees,
          thisMonth: thisMonthRevenue,
          lastMonth: lastMonthRevenue,
          monthlyRevenue
        }
      },
      topCampaigns,
      topDonors,
      summary,
      recentActivity: activity
    });

  } catch (err) {
    console.error("ADMIN STATS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getBanks = async (req, res) =>{
  try{
    const response = await axios.get("https://api.paystack.co/bank", {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });
    res.json(response.data.data);
  }catch(err){
    console.error("Bank error:", err);
    res.status(500).json({message: "Failed to load banks"});
  }
};

exports.resolveAccount = async (req,res)=>{

    try{

        const { accountNumber, bankCode } = req.body;

        const response = await axios.get(

            `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,

            {
                headers:{
                    Authorization:
                    `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }

        );

        res.json(response.data.data);

    }

    catch(err){

        console.error(err.response?.data);

        res.status(500).json({
            message: err.response?.data?.message || "Unable to verify account"
        });

    }

};

exports.getPlatformWithdrawals = async (req, res) => {
  try {

    const withdrawals = await PlatformWithdrawal.find()
      .populate("processedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(withdrawals);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message
    });
  }
};

exports.getPlatformWallet = async (req, res) => {
  try {

    const wallet = await PlatformWallet.findOne({ key: "main"});

    if (!wallet) {
      return res.json({
        balance: 0,
        totalFees: 0,
        transactionCount: 0,
        transactions: []
      });
    }

    const transactions = await Transaction.find({
      $or: [
        { type: "donation" },
        { type: "platform-withdrawal" }
      ]
    })
      .populate("user", "name email")
      .populate("campaign", "title")
      .sort({ createdAt: -1 });

    const totalFees = transactions
      .filter(t => t.type === "donation")
      .reduce(
        (sum, t) => sum + (t.platformFee || 0),
        0
      );

    res.json({
      balance: wallet.balance,
      totalFees,
      transactionCount: transactions.length,
      transactions
    });

  } catch (err) {

    console.error("GET PLATFORM WALLET ERROR:", err);

    res.status(500).json({
      message: "Failed to load platform wallet."
    });

  }
};

exports.requestPlatformWithdrawal = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const {
      amount,
      bankName,
      accountNumber,
      accountName
    } = req.body;

    const withdrawalAmount = Number(amount);

    if (
      !amount ||
      !bankName ||
      !accountNumber ||
      !accountName
    ) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    if (!withdrawalAmount || withdrawalAmount <= 0) {
      return res.status(400).json({
        message: "Invalid withdrawal amount"
      });
    }

    let wallet = await PlatformWallet.findOne();

    if (!wallet) {
     wallet = await PlatformWallet.create({
      key: "main",
      balance: 0,
      transactions: []
     });
    }

    if (wallet.balance < withdrawalAmount) {
      return res.status(400).json({
        message: "Insufficient platform balance"
      });
    }

    const withdrawal = await PlatformWithdrawal.create([{
      amount: withdrawalAmount,
      bankName,
      accountNumber,
      accountName,
      processedBy: req.user._id,
      reference:
        "PF-" +
        Date.now()
    }], {session});

const createdWithdrawal = withdrawal[0];

    const transaction = await Transaction.create([{
      user: req.user._id,
      amount: withdrawalAmount,
      type: "platform-withdrawal",
      status: "completed",
      reference: createdWithdrawal.reference
    }], {session});

    const createdTransaction = transaction[0];

    wallet.balance -= withdrawalAmount;
    wallet.transactions.push(createdTransaction._id);

    await wallet.save({session});

    await session.commitTransaction();
    session.endSession();

    await createNotification({
      io: req.app.get("io"),
      user: req.user._id,
      audience: "user",
      title: "Platform Withdrawal",
      message: `₦${withdrawalAmount.toLocaleString()} withdrawn successfully.`,
      type: "withdrawal"
    });

    res.json({
      message: "Withdrawal successful",
      withdrawal: createdWithdrawal
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({
      message: err.message
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const users = await User.find().select("-password").lean();

    for (const user of users) {

      user.campaignCount = await Campaign.countDocuments({
        owner: user._id
      });

      const donations = await Donation.find({
        user: user._id,
        status: "success"
      });

      user.donationCount = donations.length;

      user.totalDonated = donations.reduce(
        (sum, d) => sum + d.amount,
        0
      );

      const campaigns = await Campaign.find({
        owner: user._id
      });

      user.totalRaised = campaigns.reduce(
        (sum, c) => sum + (c.currentAmount || 0),
        0
      );

    }

    res.json(users);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch users"
    });
  }
};

exports.deleteCampaignAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByIdAndDelete(id);

    if (!campaign)
      return res.status(404).json({ message: "Not found" });

    const io = req.app.get("io");

    io.to("admins").emit("campaignDeleted", {
      campaignId: id
    });

    await createNotification({
      io,
      user: campaign.owner,
      audience: "user",
      title: "Campaign Deleted",
      type: "info",
      message: `Your campaign "${campaign.title}" was deleted by an Admin`
    });

    res.json({ message: "Campaign deleted" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.suspendUser = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.isSuspended = true;
    await user.save();

    req.app.get("io").emit("userUpdated", {
        userId: user._id,
        isSuspended: user.isSuspended
    });

    const io = req.app.get("io");

    io
    .to(user._id.toString())
    .emit("accountStatusChanged", {
        isSuspended: user.isSuspended
    });

    await createNotification({
      io,
      user: user._id,
      audience: "user",
      title: "Account Suspended",
      type: "info",
      message: "Your account has been suspended by Admin"
    })

    res.json({ message: "User updated", user });

  } catch (err) {
    res.status(500).json({ message: "Failed to suspend user" });
  }
};

exports.unsuspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.isSuspended = false;
    await user.save();

    res.json({ message: "User unsuspended" });

  } catch (err) {
    res.status(500).json({ message: "Error unsuspending user" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const admin = await User.findOne({ role: "admin" });

    if (!admin) {
      return res.status(500).json({ message: "No admin found" });
    }

    await Campaign.updateMany(
      { owner: userId },
      { $set: { owner: admin._id } }
    );

    await User.findByIdAndDelete(userId);

    await createNotification({
      io: req.app.get("io"),
      user: null,
      audience: "admin",
      title: "User Deleted",
      message: `You deleted "${user.name}" from the platform and transferred their campaigns to admin`,
      type: "admin_action"
    });

    res.json({ message: "User deleted and campaigns transferred to admin" });

  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getAllDonations = async (req, res) => {
  try {
    const donations = await Donation.find()
      .populate("user", "name email")
      .populate("campaign", "title");

    res.json(donations);

  } catch (err) {
    res.status(500).json({ message: "Failed to fetch donations" });
  }
};

exports.getAllCampaigns = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const campaigns = await Campaign.find().populate({
      path: "owner",
      select: "name email",
    });

    res.json(campaigns)
  } catch (err) {
    console.error("Admin campaign error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.toggleSuspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Incoming:", req.body.isSuspended);

    user.isSuspended = req.body.isSuspended;

    await user.save();

    req.app.get("io").emit("userUpdated", {
      _id: user._id,
      isSuspended: user.isSuspended
    });

    res.json({
      message: "User updated",
      user
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.flagUser = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isFlagged = !user.isFlagged;
    await user.save();

    req.app.get("io").emit("userFlagged", {
      userId: user._id,
      isFlagged: user.isFlagged
    });

    res.json({ message: "User flag updated", isFlagged: user.isFlagged });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPlatformEarnings = async (req, res) => {
  try {

    const wallet = await PlatformWallet.findOne({ key: "main" })
      .populate({
        path: "transactions",
        populate: [
          {
            path: "campaign",
            select: "title"
          },
          {
            path: "user",
            select: "name email"
          }
        ]
      });

    if (!wallet) {
      return res.json({
        balance: 0,
        totalFees: 0,
        transactionCount: 0,
        transactions: []
      });
    }

    const feeTransactions = wallet.transactions.filter(
      tx =>
        tx.type === "donation" &&
        tx.status === "success"
    );

    const totalFees = feeTransactions.reduce(
      (sum, tx) => sum + (tx.platformFee || 0),
      0
    );

    res.json({
      balance: wallet.balance,
      totalFees,
      transactionCount: feeTransactions.length,
      transactions: feeTransactions.sort(
        (a, b) => new Date(b.createdAt) - new Date (a.createdAt)
      )
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message
    });
  }
};