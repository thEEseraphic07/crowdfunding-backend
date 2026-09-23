module.exports = function (role) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles.includes(role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    req.user = decoded;
    next();
  };
};