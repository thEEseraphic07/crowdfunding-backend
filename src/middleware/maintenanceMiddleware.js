const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Settings = require("../models/settingsModel");

module.exports = async (req, res, next) => {

  try {

    const settings = await Settings.findOne();

    if (!settings?.maintenanceMode) {
      return next();
    }

    let isAdmin = false;

    const authHeader = req.headers.authorization;

    if (
      authHeader &&
      authHeader.startsWith("Bearer ")
    ) {

      const token = authHeader.split(" ")[1];

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const user = await User.findById(decoded.id);

      if (user?.isAdmin) {
        isAdmin = true;
      }
    }

    if (!isAdmin) {

      return res.status(503).json({
        message:
          "Platform is currently under maintenance"
      });

    }

    next();

  } catch (err) {

    return res.status(503).json({
      message:
        "Platform is currently under maintenance"
    });

  }
};