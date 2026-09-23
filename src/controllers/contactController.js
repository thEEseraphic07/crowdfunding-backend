const Contact = require("../models/contactModel");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendContactMessage = async(req,res)=>{

    try{

        const {
            name,
            email,
            phone,
            message
        } = req.body;

        if(!name || !email || !phone || !message){

            return res.status(400).json({
                message:"Please fill in all fields."
            });

        }

        const contact = await Contact.create({

            name,
            email,
            phone,
            message

        });
        
        console.log("Sending email to:", process.env.CONTACT_EMAIL);

        const response = await resend.emails.send({

            from:"CrowdFund <onboarding@resend.dev>",

            to:process.env.CONTACT_EMAIL,

            subject:`New Contact Message from ${name}`,

            html:`
                <h2>New Contact Message</h2>

                <p><strong>Name:</strong> ${name}</p>

                <p><strong>Email:</strong> ${email}</p>

                <p><strong>Phone:</strong> ${phone}</p>

                <p><strong>Message:</strong></p>

                <p>${message}</p>
            `
        });
        console.log(response);
        try{
        const userResponse = await resend.emails.send({
            from: process.env.EMAILS_FROM,

            to: email,

            subject: "We've received your message!",

            html:`
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <h2 style="color:#7c3aed;">
                    Thank You for Contatcing CrowdFund!
                  </h2>

                  <p>Hi <strong>${name}</strong>,</p>

                  <p>
                    We've successfully received your message.
                    Thank you for reaching out to us.
                  </p>

                  <p>
                    Our support team will review your inquiry and get back to you as soon as possible.
                  </p>

                  <hr>

                  <h3>Your Message</h3>

                  <p>
                    ${message}
                  </p>
                  
                  <hr>

                  <p>
                    Thank you for choosing <strong>CrowdFund</strong>.
                  </p>

                  <p>
                    Regards,<br>
                    CrowdFund Support Team
                  </p>
                </div>  
                    
            `
        });
        console.log("User email repsonse:", userResponse);
        }catch(err){
            console.error("Confirmation email failed:", err);
        }

        res.status(200).json({

            message:"Message sent successfully!",

            contact

        });

    }

    catch(err){

        console.error(err);

        res.status(500).json({

            message:"Unable to send message."

        });

    }

};

exports.getAllContactMessages = async (req, res) => {
    try {

        const messages = await Contact.find()
            .sort({ createdAt: -1 });

        res.status(200).json(messages);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Unable to fetch contact messages."
        });

    }
};

exports.markMessageRead = async(req, res) =>{
    try{
        const message = await Contact.findByIdAndUpdate(req.params.id,{
            status: "read"
        },{
            new: true
        }
        );
        if(!message){
            return res.status(404).json({
                message: "Message not found."
            });
        }
        res.json(message)
    }catch(err){
        console.error(err);
        res.status(500).json({
            message: "Unable to update message."
        })
    }
}

exports.deleteContactMessage = async (req, res) => {
    try{
        const message = await Contact.findByIdAndDelete(req.params.id);
        console.log("Deleting:", req.params.id);

        if(!message){
            return res.status(404).json({
                message: "Message not found."
            });
        }

        res.json({
            message: "Message deleted successfully"
        });
    }catch(err){
        console.error(err);
        res.status(500).json({
            message: "Unable to delete message.Try again later."
        })
    }
}

exports.replyToContactMessage = async (req, res) => {

    try {

        const { subject, reply } = req.body;

        if (!reply) {
            return res.status(400).json({
                message: "Reply cannot be empty."
            });
        }

        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({
                message: "Message not found."
            });
        }

        await resend.emails.send({

            from: process.env.EMAILS_FROM,

            to: contact.email,

            subject: subject || "Reply from CrowdFund Support",

            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.6">

                    <h2>Hello ${contact.name},</h2>

                    <p>${reply}</p>

                    <br>

                    <p>
                        Thank you for contacting CrowdFund.
                    </p>

                    <p>
                        Regards,<br>
                        <strong>CrowdFund Support Team</strong>
                    </p>

                </div>
            `
        });

        contact.status = "replied";
        contact.adminReply = reply;
        contact.repliedAt = new Date();

        await contact.save();

        res.json({
            message: "Reply sent successfully.",
            contact
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Unable to send reply."
        });

    }

};