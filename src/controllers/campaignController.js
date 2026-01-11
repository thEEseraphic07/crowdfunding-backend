const Campaign = require('../models/campaignModel');
exports.createCampaign = async (req, res) => {
  try {
    const { title, description, targetAmount, deadline, category, image } = req.body;

    if (!title || !description || !targetAmount || !deadline || !category) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const campaign = await Campaign.create({
      title,
      description,
      targetAmount,
      deadline,
      category,
      image,
      owner: req.user._id,
    });

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error in createCampaign:', error.stack);
    res.status(500).json({ message: error.message });
  }
};

exports.getCampaigns = async (req, res)=>{
  try{
    const { category, isActive, minAmount, maxAmount, search } = req.query;
    let filter = {};

    if(category){
      filter.category = category;
    }
    if(isActive !== undefined){
      filter.isActive = isActive === 'true';
    }
    if(minAmount || maxAmount){
      filter.targetAmount = {};
      if(minAmount) filter.targetAmount.$gte = Number(minAmount);
      if(maxAmount) filter.targetAmount.$lte = Number(maxAmount);
    }

    if(search){
      filter.$or = [
        {title: { $regex: search, $options: 'i'} },
        {description: { $regex: search, $options: 'i'} }
      ]
    }

    const campaigns = await Campaign
    .find(filter)
    .populate('owner', 'name email')
    .sort({createdAt: -1})

    res.json(campaigns);
  }catch(error){
    res.status(500).json({message: error.message});
  }
};

// exports.getCampaigns = async (req, res) => {
//   try {
//     const campaigns = await Campaign.find({ isActive: true }).populate('owner', 'name email');
//     res.json(campaigns);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate('owner', 'name email');
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCampaign = async (req, res)=>{
    try{
        const campaign = await Campaign.findById(req.params.id);

        if(!campaign) return res.status(404).json({message: "Campaign not found"});

        if(campaign.owner.toString() !==req.user._id.toString()){
            return res.status(401).json({message: "Not authorized to update this campaign"});
        }

        const {title, description, targetAmount, deadline, category, image} = req.body;

        campaign.title = title || campaign.title;
        campaign.description = description || campaign.description;
        campaign.targetAmount = targetAmount || campaign.targetAmount;
        campaign.deadline = deadline || campaign.deadline;
        campaign.category = category || campaign.category;
        campaign.image = image || campaign.image;

        const updatedCampaign = await campaign.save();
        res.json(updatedCampaign)
    }catch (error){
        console.error(error.stack)
        res.status(500).json({message: error.message})
    }
}

exports.deleteCampaign = async (req, res)=>{
    try{
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(403).json({message: "Campaign not found"});

        if(campaign.owner.toString() !==req.user._id.toString()){
            return res.status(401).json({message: "Not authorized to delete this campaign"});
        }
        await campaign.remove;
        res.json({message: "Campaign deleted successfully"})
    }catch (error){
        console.error(error.stack);
        res.status(500).json({message: error.message})
    }
}

exports.donateToCampaign = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Please provide a valid donation amount' });
    }

    const campaign = await Campaign.findById(req.params.id);

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    campaign.donations.push({
      user: req.user._id,
      amount: Number(amount),
    });

    campaign.currentAmount += Number(amount);

    await campaign.save();

    res.json({
      message: 'Donation successful',
      currentAmount: campaign.currentAmount,
    });

  } catch (error) {
    console.error('Donation error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getFilteredCampaigns = async (req, res) => {
  try {
    const { category, isActive, minAmount, maxAmount } = req.query;

    let filter = {};

    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (minAmount) filter.targetAmount = { ...filter.targetAmount, $gte: Number(minAmount) };
    if (maxAmount) filter.targetAmount = { ...filter.targetAmount, $lte: Number(maxAmount) };

    const campaigns = await Campaign.find(filter).populate('owner', 'name email');

    return res.json(campaigns);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.searchCampaigns = async (req, res)=>{
  try{
    const { q, category, isActive, page = 1, limit = 10} = req.query; 
    let filter = {};

    if(q){
      filter.$or =[
        {title: {$regex: q, $options: 'i'}},
        {description: {$regex: q, $options: 'i'}}
      ]
    }
    if(category){
      filter.category = category;
    }
    if(isActive !== undefined){
      filter.isActive = isActive === 'true';
    }

    const skip = (Number(page) -1) * Number(limit);

    const campaigns = await Campaign.find(filter)
    .populate('owner', 'name email')
    .skip(skip)
    .limit(Number(limit));

    const total = await Campaign.countDocuments(filter);

    return res.json({
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      totalCampaigns: total,
      campaigns,
    });
  }catch (error){
    console.error("Error in searchCampaigns:", error);
    return res.status(500).json({messag: error.message});
  }
}