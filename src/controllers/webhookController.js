const crypto = require("crypto");
const { completeDonation } = require("./paymentController")

exports.paystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    const hash = crypto
      .createHmac("sha512", secret)
      .update(req.body)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    console.log("PAYSTACK EVENT:", event.event);

    if (event.event !== "charge.success") {
      return res.sendStatus(200);
    }

    const data = event.data;

    const result = await completeDonation({
      reference: data.reference,
      paystackData: data,
      io: req.app.get("io")
    });

    if (!result.success) {
      console.error(
        "Donation completion failed:",
        result.message
      );

      return res.sendStatus(200);
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error(
      "Webhook error:",
      error.message
    );

    return res.sendStatus(500);
  }
};