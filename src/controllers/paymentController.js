const mongoose = require("mongoose");
const axios = require("axios");
const Donation = require("../models/donationModel");
const Campaign = require("../models/campaignModel");
const Transaction = require("../models/transactionModel");
const createNotification = require("../utils/createNotification");
const PlatformWallet =require("../models/platformWallet");
const Settings = require("../models/settingsModel");
const User = require("../models/userModel");

const completeDonation = async ({
  reference,
  paystackData,
  userId = null,
  io
}) => {
  const session = await mongoose.startSession();

  try {
    const query = {
      reference,
      status: "pending"
    };

    if (userId) {
      query.user = userId;
    }

    const donation = await Donation.findOne(query).session(session);

    if (!donation) {
      const existingDonation = await Donation.findOne({ reference });

      if (existingDonation?.status === "success") {
        return {
          success: true,
          alreadyVerified: true
        };
      }

      return {
        success: false,
        status: 404,
        message: "Donation not found"
      };
    }

    if (Number(paystackData.amount) !== Number(donation.amount) * 100) {
      return {
        success: false,
        status: 400,
        message: "Amount mismatch"
      };
    }

    if (paystackData.currency !== "NGN") {
      return {
        success: false,
        status: 400,
        message: "Invalid currency"
      };
    }

    if (paystackData.reference !== donation.reference) {
      return {
        success: false,
        status: 400,
        message: "Reference mismatch"
      };
    }

    session.startTransaction();

    const campaign = await Campaign.findById(
      donation.campaign
    ).session(session);

    if (!campaign) {
      await session.abortTransaction();

      return {
        success: false,
        status: 404,
        message: "Campaign not found"
      };
    }

    const settings = await Settings.findOne();
    const feeRate = (settings?.platformFee || 5) / 100;

    const feeAmount = donation.amount * feeRate;
    const creatorAmount = donation.amount - feeAmount;

    const owner = await User.findById(
      campaign.owner
    ).session(session);

    if (!owner) {
      await session.abortTransaction();

      return {
        success: false,
        status: 404,
        message: "Campaign owner not found"
      };
    }

    await User.findByIdAndUpdate(
      campaign.owner,
      {
        $inc: {
          walletBalance: creatorAmount
        }
      },
      { session }
    );

    const updatedCampaign = await Campaign.findOneAndUpdate(
      {
        _id: campaign._id,
        $expr: {
          $lte: [
            { $add: ["$currentAmount", donation.amount] },
            "$targetAmount"
          ]
        }
      },
      {
        $inc: {
          currentAmount: donation.amount
        },
        $push: {
          donations: {
            amount: donation.amount,
            user: donation.user
          }
        }
      },
      {
        new: true,
        session
      }
    );

    if (!updatedCampaign) {
      await session.abortTransaction();

      return {
        success: false,
        status: 400,
        message: "This donation would exceed the campaign target."
      };
    }

    let wallet = await PlatformWallet.findOne({
      key: "main"
    }).session(session);

    if (!wallet) {
      wallet = await PlatformWallet.create(
        [
          {
            key: "main",
            balance: 0,
            transactions: []
          }
        ],
        { session }
      );

      wallet = wallet[0];
    }

    const tx = await Transaction.create(
      [
        {
          user: campaign.owner,
          donor: donation.user,
          amount: creatorAmount,
          platformFee: feeAmount,
          originalAmount: donation.amount,
          type: "donation",
          status: "success",
          reference: donation.reference,
          campaign: campaign._id
        }
      ],
      { session }
    );

    const transaction = tx[0];

    wallet.balance += feeAmount;
    wallet.transactions.push(transaction._id);

    await wallet.save({ session });

    donation.status = "success";

    await donation.save({ session });

    await session.commitTransaction();

    await createNotification({
      io,
      user: campaign.owner,
      title: "New Donation",
      message: `You received ₦${donation.amount}`,
      type: "donation"
    });

    await createNotification({
      io,
      user: donation.user,
      title: "Donation successful",
      message: `You donated ₦${donation.amount} to ${campaign.title}`,
      type: "donation"
    });

    return {
      success: true,
      alreadyVerified: false
    };

  } catch (err) {

    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    if (err.code === 11000) {
      return {
        success: false,
        status: 400,
        message: "Duplicate transaction detected"
      };
    }

    console.error(err);

    return {
      success: false,
      status: 500,
      message: "Donation completion failed"
    };

  } finally {
    await session.endSession();
  }
};

exports.initializePayment = async (req, res) => {
  try {
    const {
      campaignId,
      amount
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        message: "Invalid amount"
      });
    }

    const campaign =
      await Campaign.findById(
        campaignId
      );

    if (!campaign) {
      return res.status(404).json({
        message:
        "Campaign not found"
      });
    }

    if(
      !campaign.isApproved ||
      !campaign.isActive ||
      campaign.isFlagged ||
      campaign.status !== "active"
    ){
      return res.status(400).json({
        message:
        "Campaign is not active for donations"
      });
    }

    if(campaign.deadline && new Date(campaign.deadline) <= new Date()){
      return res.status(400).json({
        message: "This campaign has ended and is no longer accepting donations."
      })
    }

    const remainingAmount = Number(campaign.targetAmount) - Number(campaign.currentAmount);

    if(Number(amount) > remainingAmount){
      return res.status(400).json({
        message: `Donation cannot exceed the remaining target of ₦${remainingAmount}`
      });
    }

    const reference =
      `CF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const exsistingDonation = await Donation.findOne({reference});

      if(exsistingDonation){
        return res.status(400).json({
          message:
          "Donation with this reference already exists"
        });
      }

    const response =
      await axios.post(

        "https://api.paystack.co/transaction/initialize",

        {

          email:
          req.user.email,

          amount:
          Number(amount) * 100,

          reference,

          callback_url: `${process.env.CLIENT_URL}/pages/payment-success.html`

        },

        {

          headers: {

            Authorization:
            `Bearer ${process.env.PAYSTACK_SECRET_KEY}`

          }

        }

      );

    await Donation.create({

      user:
      req.user._id,

      campaign:
      campaignId,

      amount:
      Number(amount),

      reference,

      status:
      "pending"

    });

    return res.json(
      response.data.data
    );

  }

  catch(err){

    console.error(
      "Payment initialization error:",
      err.response?.data
      ||
      err.message
    );

    return res
    .status(500)

    .json({

      message:
      err.response?.data?.message
      ||
      "Payment initialization failed"

    });

  }

};

exports.verifyPayment = async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data.data;

    if (data.status !== "success") {
      return res.status(400).json({
        message: "Payment failed"
      });
    }

    const result = await completeDonation({
      reference,
      paystackData: data,
      userId: req.user._id,
      io: req.app.get("io")
    });

    if (!result.success) {
      return res.status(result.status).json({
        message: result.message
      });
    }

    if (result.alreadyVerified) {
      return res.json({
        message: "Donation already verified"
      });
    }

    return res.json({
      message: "Payment verified successfully"
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      message: "Verification failed"
    });
  }
};

exports.completeDonation = completeDonation;