const express = require ('express');
const path = require ('path');
const  authRoute= require ('./routes/authRoute')
const paymentRoutes = require ('./routes/paymentRoutes')
const webhookRoutes = require('./routes/webhookRoutes')
const cors = require ('cors');
const connectDB  = require ('./config/db');
const donationRoutes = require ('./routes/donationRoute')
const campaignRoutes = require ('./routes/campaignRoutes')
require ('dotenv').config();

const app = express();
connectDB();

app.use(cors());
app.use('/api/webhook', webhookRoutes);
app.use(express.json());

app.use(express.static(path.join(__dirname, '../../FRONTEND')))

app.use('/api/auth', authRoute);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/donations', donationRoutes)
app.use('/api/payments', paymentRoutes)

app.get('/', (req, res)=>{
    res.send("API is running...")
});

module.exports = app;