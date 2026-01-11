const axios = require('axios');
const Donation = require('../models/donationModel');
const Campaign = require('../models/campaignModel');

exports.initializePayment = async (req, res) => {
  const { campaignId, amount } = req.body;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const reference = `CF-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: req.user.email,
        amount: amount * 100, // kobo
        reference,
        metadata: {
          campaignId,
          userId: req.user._id.toString(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    await Donation.create({
      user: req.user._id,
      campaign: campaignId,
      amount,
      reference,
      status: 'pending',
    });

    res.status(200).json(response.data.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ message: 'Payment initialization failed' });
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

    const paymentData = response.data.data;

    if (paymentData.status !== 'success') {
      return res.status(400).json({ message: 'Payment not successful' });
    }

    const donation = await Donation.findOne({ reference });
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    if (donation.status === 'success') {
      return res.status(400).json({ message: 'Payment already verified' });
    }

    donation.status = 'success';
    await donation.save();

    res.json({ message: 'Payment verified successfully' });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ message: 'Verification failed' });
  }
};

