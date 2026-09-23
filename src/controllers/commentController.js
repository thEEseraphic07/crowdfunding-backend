const Comment = require("../models/commentModel");

exports.createComment = async (req, res) => {

  try {

    const { text } = req.body;

    const { campaignId } = req.params;

    if (!text) {
      return res.status(400).json({
        message: "Comment required"
      });
    }

    const comment = await Comment.create({

      campaign: campaignId,

      user: req.user._id,

      text

    });

    const populatedComment =
    await Comment.findById(comment._id)
    .populate("user", "name profileImage");

    res.status(201).json(populatedComment);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed to create comment"
    });
  }
};

exports.getComments = async (req, res) => {

  try {

    const comments = await Comment.find({

      campaign: req.params.campaignId

    })
    .populate("user", "name profileImage")
    .sort({ createdAt: -1 });

    res.json(comments);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed to load comments"
    });
  }
};