const Donation = require('../models/donationModel');

exports.getMyDonations = async (req, res) => {
  try {
    const donations = await Donation.find({ user: req.user._id })
      .populate('campaign', 'title goalAmount image')
      .sort({ createdAt: -1 });

    res.status(200).json(donations);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to fetch donation history' });
  }
};

exports.createDonation = async(req, res) => {
  try{
    const { campaignId, amount } = req.body;

    const campaign = await Campaign.findById(req.body.campaignId);

    if (campaign.status !== "active") {
     return res.status(400).json({message: "This campaign is no longer accepting donations"});
    }

    if(!campaign.isApproved) {
      return res.status(400).json({
        message: "Campaign not approved yet"
      });
    }

    const donation = await Donation.create({
      donor: req.user.id,
      campaign: campaignId,
      amount
    });

    const io = req.app.get("io");

    io.to("admins").emit("newDonation", {
      user: donation.user,
      campaign: donation.campaign,
      amount: donation.amount,
      createdAt: donation.createdAt
    });

    req.app.get("io").emit("newDonation", donation);

    res.status(201).json({
      success: true,
      message: "Donation successful",
      donation
    });
  }catch(error){
    console.error(error);
    res.status(500).json({ sucess: false, message: "Failed to process donation. Server Error"});
  }
}

exports.refundDonation = async (req, res) => {
  const donation = await Donation.findById(req.params.id);

  donation.status = "refunded";
  await donation.save();

  res.json({ message: "Donation refunded" });
};
