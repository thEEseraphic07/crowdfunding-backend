const crypto = require("crypto");
const { completeDonation } = require("./paymentController");
const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");
const PlatformWallet = require("../models/platformWallet")
const PlatformWithdrawal = require("../models/platformWithdrawalModel")
const createNotification = require("../utils/createNotification");

exports.paystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    const hash = crypto
      .createHmac("sha512", secret)
      .update(req.body)
      .digest("hex");

    const signature = req.headers["x-paystack-signature"];

    if (
      !signature ||
      hash.length !== signature.length ||
      !crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(signature)
      )
    ) {
      return res.status(401).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    console.log("PAYSTACK EVENT:", event.event);

    if (event.event === "charge.success") {
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
      }

      return res.sendStatus(200);
    }

    if (event.event === "transfer.success") {
      const data = event.data;

      const platformWithdrawal = await PlatformWithdrawal.findOne({
        reference: data.reference
      });

      if(platformWithdrawal){
        if(platformWithdrawal.status === "completed"){
          return res.sendStatus(200);
        }

        platformWithdrawal.status = "completed";
        await platformWithdrawal.save();

        await Transaction.findOneAndUpdate({
          reference: data.reference,
          type: "platform-withdrawal"
        },
        {
          status: "completed"
        }
      );

      console.log("Platform withdrawal completed:", platformWithdrawal.reference);
      return res.sendStatus(200);
      }

      const withdrawal = await Transaction.findOne({
        $or: [
          { transferReference: data.reference },
          { reference: data.reference }
        ],
        type: "withdrawal"
      });

      if (!withdrawal) {
        console.error(
          "Withdrawal not found:",
          data.reference
        );

        return res.sendStatus(200);
      }

      if (withdrawal.status === "completed") {
        return res.sendStatus(200);
      }

      withdrawal.status = "completed";
      withdrawal.transferReference = data.reference;

      await withdrawal.save();

      try {
        await createNotification({
          io: req.app.get("io"),
          user: withdrawal.user,
          title: "Withdrawal Completed",
          message: `₦${withdrawal.amount} withdrawal has been completed successfully`,
          type: "withdrawal"
        });
      } catch (notificationError) {
        console.error(
          "Withdrawal notification error:",
          notificationError
        );
      }

      try {
        req.app
          .get("io")
          .to(withdrawal.user.toString())
          .emit("withdrawalCompleted", {
            amount: withdrawal.amount,
            status: "completed"
          });
      } catch (socketError) {
        console.error(
          "Withdrawal socket error:",
          socketError
        );
      }

      console.log(
        "Withdrawal completed:",
        withdrawal.reference
      );

      return res.sendStatus(200);
    }

    if (
  event.event === "transfer.failed" ||
  event.event === "transfer.reversed"
) {
  const data = event.data;

      const platformWithdrawal = await PlatformWithdrawal.findOne({
      reference: data.reference
    });

    if (platformWithdrawal) {

      if (platformWithdrawal.status === "failed") {
        return res.sendStatus(200);
      }

      const wallet = await PlatformWallet.findOne({
        key: "main"
      });

      if (!wallet) {
        console.error(
          "Platform wallet not found for failed withdrawal:",
          data.reference
        );

        return res.sendStatus(200);
      }

      if (platformWithdrawal.status === "processing") {
        wallet.balance += Number(platformWithdrawal.amount);
        await wallet.save();

        platformWithdrawal.status = "failed";
        await platformWithdrawal.save();

        await Transaction.findOneAndUpdate(
          {
            reference: data.reference,
            type: "platform-withdrawal"
          },
          {
            status: "failed"
          }
        );

        console.log(
          "Platform withdrawal failed/reversed and refunded:",
          platformWithdrawal.reference
        );
      }

      return res.sendStatus(200);
    }

  const withdrawal = await Transaction.findOne({
    $or: [
      { transferReference: data.reference },
      { reference: data.reference }
    ],
    type: "withdrawal"
  });

  if (!withdrawal) {
    console.error(
      "Withdrawal not found:",
      data.reference
    );

    return res.sendStatus(200);
  }

  if (withdrawal.status !== "approved" &&
    withdrawal.status !== "processing"){
    return res.sendStatus(200);
  }

  const user = await User.findById(withdrawal.user);

  if (!user) {
    console.error(
      "User not found for withdrawal:",
      withdrawal.user
    );

    return res.sendStatus(200);
  }

  withdrawal.status = "failed";

  await withdrawal.save();

  user.walletBalance =
    Number(user.walletBalance) +
    Number(withdrawal.amount);

  await user.save();

  try {
    await createNotification({
      io: req.app.get("io"),
      user: withdrawal.user,
      title: "Withdrawal Failed",
      message:
        `Your ₦${withdrawal.amount} withdrawal could not be completed. ` +
        `The funds have been returned to your wallet.`,
      type: "withdrawal"
    });
  } catch (notificationError) {
    console.error(
      "Withdrawal notification error:",
      notificationError
    );
  }

  try {
    req.app
      .get("io")
      .to(withdrawal.user.toString())
      .emit("withdrawalFailed", {
        amount: withdrawal.amount,
        status: "failed"
      });
  } catch (socketError) {
    console.error(
      "Withdrawal socket error:",
      socketError
    );
  }

  console.log(
    "Withdrawal failed/reversed and refunded:",
    withdrawal.reference
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