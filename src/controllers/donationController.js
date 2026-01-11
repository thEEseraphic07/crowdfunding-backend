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
