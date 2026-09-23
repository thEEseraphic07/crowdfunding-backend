const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const protect = async (req, res, next) => {

  try {

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {

      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const user = await User.findById(decoded.id)
      .select("-password");

      if (!user) {
        return res.status(401).json({
          message: "User not found"
        });
      }

      if (user.isSuspended) {
        return res.status(403).json({
          message: "Account suspended"
        });
      }

      req.user = user;

      next();

    } else {

      return res.status(401).json({
        message: "Not authorized, no token"
      });

    }

  } catch (error) {

    console.error("Authentication error:",error.message);

    return res.status(401).json({
      message: "Not authorized, token failed"
    });

  }
};

const adminOnly = (req, res, next) => {

  if (!req.user || !req.user.isAdmin) {

    return res.status(403).json({
      message: "Admins only"
    });

  }

  next();
};

module.exports = {
  protect,
  adminOnly
};