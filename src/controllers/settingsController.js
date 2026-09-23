const Settings = require("../models/settingsModel");

exports.getSettings = async (req, res) => {

  try {

    let settings = await Settings.findOne();

    if (!settings) {

      settings = await Settings.create({

        platformName: "CrowdFund",

        platformFee: 5,

        currency: "NGN",

        minGoal: 100,

        maxGoal: 1000000,

        maxDuration: 90,

        autoApproveCampaigns: false,

        maintenanceMode: false,

        guestDonations: true,

        enable2FA: true,

        emailVerification: true,

        minWithdrawal: 50,

        withdrawalFee: 2,

        payoutDelay: 7,

        campaignCategories: [
          "Education",
          "Health",
          "Food",
          "Technology"
        ]

      });

    }

    res.status(200).json(settings);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

};

exports.updateSettings = async (req, res) => {

  try {
    console.log(req.body);

const platformFee = Number(req.body.platformFee);
const withdrawalFee = Number(req.body.withdrawalFee);
const minGoal = Number(req.body.minGoal);
const maxGoal = Number(req.body.maxGoal);
const maxDuration = Number(req.body.maxDuration);

if (isNaN(platformFee) || platformFee < 0 || platformFee > 100) {
  return res.status(400).json({
    message: "Platform fee must be between 0 and 100"
  });
}

if (isNaN(withdrawalFee) || withdrawalFee < 0 || withdrawalFee > 100) {
  return res.status(400).json({
    message: "Withdrawal fee must be between 0 and 100"
  });
}

if (isNaN(minGoal) || isNaN(maxGoal) || minGoal < 0 || maxGoal < 0) {
  return res.status(400).json({
    message: "Campaign goals cannot be negative"
  });
}

if (isNaN(maxDuration) || Number(maxDuration) < 1) {
  return res.status(400).json({
    message: "Invalid campaign duration"
  });
}

    let settings = await Settings.findOne();

    if (!settings) {

      settings = new Settings(req.body);

    } else {

      Object.assign(settings, req.body);

    }

    await settings.save();

    res.status(200).json({

      message: "Settings updated successfully",

      settings

    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message
    });

  }

};