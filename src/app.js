require('dotenv').config();
const express = require('express');

const authRoute = require('./routes/authRoute');
const paymentRoutes = require('./routes/paymentRoutes');
const walletRoute = require ('./routes/walletRoute');
const withdrawRoute = require ('./routes/withdrawRoute')
const webhookRoutes = require('./routes/webhookRoutes');
const cors = require('cors');
const connectDB = require('./config/db');
const donationRoutes = require('./routes/donationRoute');
const campaignRoutes = require('./routes/campaignRoutes');
const adminRoute = require('./routes/adminRoute');
const notificationRoute = require('./routes/notificationRoute');
const recentRoute = require ('./routes/recentRoute');
const settingsRoute = require('./routes/settingsRoute');
const commentRoute = require("./routes/commentRoute");
const contactRoute = require("./routes/contactRoute");
const announcementRoute = require("./routes/announcementRoute");
const maintenanceMiddleware = require("./middleware/maintenanceMiddleware");

const app = express();
connectDB();

app.use(cors({
  origin: process.env.CLIENT_URL,
}));

app.use('/api/webhook', webhookRoutes);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(maintenanceMiddleware);

app.use('/api/auth', authRoute);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoute);
app.use('/api/withdraw', withdrawRoute);
app.use('/api/admin', adminRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/activity', recentRoute);
app.use("/api/comments", commentRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/contact', contactRoute);
app.use('/api/announcements', announcementRoute);

app.get("/", (req, res) => {
    res.json({
        message: "CrowdFund API is running"
    });
});

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  res.status(err.status || 500).json({
    message: "Something went wrong on the server"
  });
});

module.exports = app;