const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
    try {
        const response = await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html
        });

        console.log("Email sent successfully:", response);

        return response;
    } catch (err) {
        console.error("RESEND ERROR:", err);
        throw err;
    }
};

module.exports = sendEmail;