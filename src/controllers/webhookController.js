const crypto = require ('crypto');
const Donation = require ('../models/donationModel');
const Campaign = require ('../models/campaignModel');


exports.paystackWebhook = async (req, res)=>{
    console.log('PAYSTACK WEBHOOK HIT');
    console.log(req.body);
    res.sendStatus(200)
    try{
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const hash = crypto
        .createHmac('sha512', secret)
        .update(req.body)
        .digest('hex');

        if (hash !== req.headers['x-paystack-signature']){
            return res.sendStatus(401).send('Invalid signature')
        }

        const event = JSON.parse(req.body.toString());
        console.log('PAYSTACK EVENT:', event.event)
        console.log('DATA:', event.data);

        if(event.event === 'charge.success'){
            const data = event.data;
            const reference = data.reference;

            const donation = await Donation.findOne({reference});

            if(!donation || donation.status === 'success'){
                return res.sendStatus(200)
            }

            donation.status = 'success';
            donation.paidAt = new Date();
            await donation.save();

           await Campaign.findByIdAndUpdate(donation.campaign, {
              $inc: { raisedAmount: donation.amount },
           });
        }
        res.sendStatus(200);
    }catch(error){
        console.error('Webhook error:', error.message)
        res.sendStatus(500)
    }
}