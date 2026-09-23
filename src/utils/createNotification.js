const Notification = require("../models/notificationModel");

const createNotification = async ({
  io,
  user = null,
  audience = "user",
  title,
  message,
  type = "info"
}) => {

  try {

    const notification =
    await Notification.create({

      user,

      audience,

      title,

      message,

      type

    });


    if (audience === "admin") {

      io.to("admins").emit(
        "adminNotification",
        notification
      );
    }


    if (
      audience === "user" &&
      user
    ) {

      io.to(user.toString()).emit(
        "userNotification",
        notification
      );
    }

    return notification;

  } catch (error) {

    console.error(
      "Notification Error:",
      error
    );
  }
};

module.exports = createNotification;