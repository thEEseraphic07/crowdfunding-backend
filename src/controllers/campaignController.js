const Campaign = require('../models/campaignModel');
const User = require('../models/userModel');
const Settings = require ("../models/settingsModel");
const createNotification =  require("../utils/createNotification");
const Donation = require ("../models/donationModel");


exports.createCampaign = async (req, res) => {
  try {
    const {
      title,
      description,
      targetAmount,
      deadline,
      category,
      image
    } = req.body;

    if (!title || !description || !targetAmount || !deadline || !category) {
      return res.status(400).json({
        message: "Please provide all required fields"
      });
    }

    if (new Date(deadline) <= new Date()) {
      return res.status(400).json({
        message: "Deadline must be in the future"
      });
    }

    if (!req.user) {
      return res.status(401).json({
        message: "Not authorized"
      });
    }

    const settings = await Settings.findOne();

const allowedCategories = settings?.campaignCategories || [];

const selectedCategory = allowedCategories.find(
  cat => cat.toLowerCase() === category.trim().toLowerCase()
);

console.log("Selected category:", JSON.stringify(category));
console.log("Allowed categories:", allowedCategories);

if (!selectedCategory) {
  return res.status(400).json({
    message: "Please select a valid campaign category."
  });
}

    const autoApprove = settings?.autoApproveCampaigns === true;

    const campaign = await Campaign.create({
      console.log("Creating campaign for user:", req.user?._id);
      title,
      description,
      targetAmount,
      deadline,
      category: selectedCategory,
      image,
      owner: req.user._id,
      isApproved: autoApprove,
      isActive: autoApprove,
      isFlagged: false,
      status: autoApprove ? "active" : "pending"
    });

    const io = req.app.get("io");

    if (io) {
      if (!autoApprove) {
        io.to("admins").emit("newCampaign", campaign);
      }

      if (autoApprove) {
        io.emit("campaignApproved", {
          _id: campaign._id,
          title: campaign.title,
          status: campaign.status
        });
      }

      io.emit("newCampaign", {
        _id: campaign._id,
        title: campaign.title,
        description: campaign.description,
        targetAmount: campaign.targetAmount,
        currentAmount: campaign.currentAmount || 0,
        deadline: campaign.deadline,
        category: campaign.category,
        image: campaign.image,
      });
    }

    return res.status(201).json(campaign);

  } catch (error) {
    console.error("Error in createCampaign:", error.stack);

    return res.status(500).json({
      message: error.message
    });
  }
};


exports.getSingleCampaign = async (req, res) =>{
  try{
    const campaign = await Campaign.findById(req.params.id)
    .populate("owner", "name bio profileImage");

    if(!campaign){
      return res.status(404).json({
        message: "Campaign not found"
      });
    }
    res.json(campaign);
  }catch(err){
    console.error("Get campaign error:", err);
    res.status(500).json({
      message: "Server error"
    });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const { category, minAmount, maxAmount, search } = req.query;

    let filter = {
      isApproved: true,
      isActive: true,
      isFlagged: false,
      status: "active",
      deadline: { $gt: new Date() }
    };

    if (category) {
      filter.category = category;
    }

    if (minAmount || maxAmount) {
      filter.targetAmount = {};

      if (minAmount) {
        filter.targetAmount.$gte = Number(minAmount);
      }

      if (maxAmount) {
        filter.targetAmount.$lte = Number(maxAmount);
      }
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const campaigns = await Campaign
      .find(filter)
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.json(campaigns);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate('owner', 'name email bio profileImage');
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
        campaign.category = selectedCategory || campaign.category;
        campaign.image = image || campaign.image;

        const updatedCampaign = await campaign.save();
        res.json(updatedCampaign)
    }catch (error){
        console.error(error.stack)
        res.status(500).json({message: error.message})
    }
}

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

exports.getMyCampaigns = async (req, res) => {
  try{
    const campaigns = await Campaign.find({
      owner: req.user._id
    })
    .sort({ createdAt: -1});

    res.json(campaigns);
  }catch(error){
    res.status(500).json({message: error.message});
  }
}

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
    return res.status(500).json({message: error.message});
  
  }
}

exports.endCampaign = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin only" });
    }

    const campaign = await Campaign.findById(req.params.id);
    console.log("CAMPAIGN FOUND:", campaign);
    console.log("OWNER FIELD:", campaign.owner);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    await Campaign.findByIdAndUpdate(req.params.id, {
      status: "ended"
    });

    const io = req.app.get("io");

    await createNotification({
      io,
      user: campaign.owner,
      title: "Campaign Ended",
      type: "campaign_ended",
      message: `Your campaign "${campaign.title}" was ended by admin`
    });

    await createNotification({
     io,
     audience: "admin",
     title: "Campaign Ended",
     message: `Campaign "${campaign.title}" was ended`,
     type: "admin_action"
    });

    const donations = await Donation.find({ campaign: campaign._id });

    const donorIds = [...new Set(donations.map(d => d.user.toString()))];

    for (let userId of donorIds) {
      await createNotification({
        io,
        user: userId,
        audience: "user",
        type: "campaign_ended",
        message: `A campaign you donated to ("${campaign.title}") has ended`
      });
    }

    io.to("admins").emit("notification", {
      message: `Campaign "${campaign.title}" ended`,
      type: "admin_action",
      time: new Date()
    });

    io.emit("campaignUpdated", {
      campaignId: campaign._id,
      status: "ended"
    });

    res.json({ message: "Campaign ended successfully" });

  } catch (err) {
    console.error("END CAMPAIGN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.flagCampaign = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin only" });
    }

    const updated = await Campaign.findByIdAndUpdate(
      req.params.id,
      { isFlagged: true, status: "flagged" },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    req.app.get("io").emit("campaignFlagged", {
      campaignId: updated._id
    });

    res.json({ message: "Campaign flagged successfully" });

  } catch (err) {
    console.error("FLAG ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.unflagCampaign = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin only" });
    }

    const updated = await Campaign.findByIdAndUpdate(
      req.params.id,
      { isFlagged: false, status: "active" },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    req.app.get("io").emit("campaignUnflagged", {
      campaignId: updated._id
    });

    res.json({ message: "Campaign unflagged successfully" });

  } catch (err) {
    console.error("UNFLAG ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getTrendingCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({
      isApproved: true,
      isActive: true,
      isFlagged: false,
      status: "active",
      deadline: {$gt: new Date()}
    })
      .populate("owner", "name")
      .sort({ currentAmount: -1 })
      .limit(10);

    return res.json(campaigns);
  } catch (err) {
    console.error("Trending error:", err);
    return res.status(500).json({ message: err.message });
  }
};