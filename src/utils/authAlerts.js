const sendEmail = require("../utils/sendEmail");
const getLocationFromIP = require("../utils/getLocationFromIp");

const sendLoginAlert = async ({ user, req }) => {
  const ip = req.ip;
  const userAgent = req.headers["user-agent"];

  await sendEmail(
    {
      to: user.email,
      subject: "New Login Detected",
      html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h2>New Login Detected</h2>

      <p>Your account was accessed successfully.</p>

      <p><strong>IP Address:</strong> ${ip}</p>

      <p><strong>Device:</strong> ${userAgent}</p>

      <p>If this wasn't you, reset your password immediately.</p>
    </div>
    `
 });
};

module.exports = { sendLoginAlert };