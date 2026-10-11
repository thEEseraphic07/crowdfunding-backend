const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail')
const createNotification = require('../utils/createNotification');
const Settings = require("../models/settingsModel");
const { sendLoginAlert } = require('../utils/authAlerts');


const generateToken = (id, rememberMe) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? "30d" : '1h',
  });
};

exports.registerUser = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  try {
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const userExists = await User.findOne({email});
    if(userExists && userExists.isVerified){
      return res.status(400).json ({message: "User already exists"});
    }

    if(userExists && !userExists.isVerified){
      return res.status(400).json({message: "Account exists but is not verified. Please check your email."});
    }
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    const user = new User({
      name,
      email,
      password,
      verificationToken: hashedToken,
      verificationTokenExpire: Date.now() + 24 * 60 * 60 * 1000,
      isVerified: false
    });

    await user.save();

   await createNotification({
     io: req.app.get("io"),
     audience: "admin", 
     title: "New User",
     message: `${user.name} just registered`,
     type: "user"
    });

  
    const verificationUrl = `${process.env.API_URL}/api/auth/verify-email/${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: "Verify Your Email",
      html: `
      <h2>Welcome to CrowdFund</h2>
      <p>Please verify your email by clicking the button below:</p>
      <p>
       <a href="${verificationUrl}">
       Verify Email
       </a>
      </p>
      <p> This link expires in 24 hours.</p>
      `
    })

    res.status(201).json({
      message: "Registration successful. Please check your email to verify your account."
    });

  } catch (error) {
    console.error("Email failed:",error);
    res.status(500).json({ message: "Registration failed" });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.params;
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Verification token is invalid or has expired",
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;

    await user.save();

    res.redirect(`${process.env.CLIENT_URL}/FRONTEND/pages/login.html`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password, rememberMe } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: "Account suspended" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Verify email first" });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({ message: "Account locked" });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await user.save();

      return res.status(401).json({ message: "Invalid credentials" });
    }

  
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    const settings = await Settings.findOne({});

    console.log("SETTINGS:", settings);
    console.log("2FA ENABLED:", settings?.enable2FA);

    const require2FA = settings?.enable2FA === true;

    if (require2FA) {
      const otp = Math.floor(100000 + Math.random() * 900000);

      user.twoFactorCode = otp;
      user.twoFactorExpires = Date.now() + 10 * 60 * 1000;

      await user.save();

      await sendEmail({
        to: user.email,
        subject: "Your Login OTP",
        html: `
        <div style="font-family:sans-serif;padding:20px:">
        <h2>CrowdFund Security Verification</h2>

        <p>Your login OTP is:</p>

        <div style="font-size:32px;
        font-weight:bold;
        letter-spacing:5px;
        color:#2563eb;
        margin:20px 0;
        ">
        ${otp}
        </div>
        <p>This OTP is valid for 10 minutes.</p>
        </div>
        `
      });

      return res.json({
        message: "OTP sent",
        twoFactorRequired: true,
        email: user.email
      });
    }

    const token = generateToken(user._id, rememberMe);
    await sendLoginAlert({ user, req });

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.verify2FA = async (req, res) => {
  try {
    const { email, code, rememberMe } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        message: "Email and OTP are required"
      });
    }

    const settings = await Settings.findOne({});

    if (settings?.enable2FA !== true) {
      return res.status(403).json({
        message: "Two-factor authentication is disabled"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid verification request"
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        message: "Account suspended"
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Verify email first"
      });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({
        message: "Account locked"
      });
    }

    if (
      user.twoFactorCode == null ||
      user.twoFactorExpires == null
    ) {
      return res.status(400).json({
        message: "No active OTP. Please log in again."
      });
    }

    if (
      String(user.twoFactorCode) !== String(code).trim()
    ) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    if (new Date(user.twoFactorExpires).getTime() <= Date.now()) {
      user.twoFactorCode = null;
      user.twoFactorExpires = null;
      await user.save();

      return res.status(400).json({
        message: "OTP expired. Please log in again."
      });
    }

    user.twoFactorCode = null;
    user.twoFactorExpires = null;

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip;
    user.lastLoginUserAgent = req.headers["user-agent"];

    await user.save();

    const token = generateToken(user._id, rememberMe);

    await sendLoginAlert({ user, req });

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error("2FA verification error:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const settings = await Settings.findOne({});
    if(settings?.enable2FA !== true){
      return res.status(403).json({
        message: "Two-factor authentication is disabled"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (
      user.otpResendBlockedUntil &&
      user.otpResendBlockedUntil > Date.now()
    ) {
      return res.status(429).json({
        message:
          "Too many OTP requests. Try again later."
      });
    }

    if (user.otpResendAttempts >= 3) {

      user.otpResendBlockedUntil =
        Date.now() + 30 * 1000;

      user.otpResendAttempts = 0;

      await user.save();

      return res.status(429).json({
        message:
          "Too many OTP requests. Wait 30 seconds."
      });
    }

    const otp =
      Math.floor(100000 + Math.random() * 900000);

    user.twoFactorCode = otp;

    user.twoFactorExpires = Date.now() + 10 * 60 * 1000;

    user.otpResendAttempts += 1;

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Your New OTP",
      html: `
      <div style="font-family:sans-serif;padding:20px;">
        <h2>New OTP Request</h2>

        <p>Your new verification code is:</p>

        <div style="
          font-size:32px;
          font-weight:bold;
          letter-spacing:5px;
          color:#2563eb;
          margin:20px 0;
        ">
          ${otp}
        </div>

        <p>This OTP expires in 10 minutes.</p>
      </div>
      `
    }); 

    return res.json({
      message: "OTP resent successfully"
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Failed to resend OTP"
    });
  }
}

exports.updateProfile = async (req, res) =>{
  try{
    const userId = req.user._id;
    const { name, email } = req.body;

    if(!name || !email){
      return res.status(400).json({ success: false, message: "Name and Email are required" });
    }

    const existingUser = await User.findOne({email, _id: {$ne: userId}});
    if(existingUser){
      return res.status(400).json({success: false, message: "Email already in use"});
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {name, email},
      {new: true, runValidators:true}
    ).select("-password");
    await user.save();

    await createNotification({
      io: req.app.get("io"),
      user: req.user._id,
      audience: "user",
      title: "Profile Updated",
      message: "Your profile was updated successfully.",
      type: "info",
    });

    res.status(200).json({success: true, user});

  }catch(err){
    console.error("Update profile error:", err);
    res.status(500).json({ success: false, message: "Server error"});
  }
}

exports.forgotPassword = async (req, res) => {
  console.log("FORGOT PASSWORD HIT");

  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: 'If email exists, reset link sent' });
    }

    console.log("User found for password reset:", user.email);

    const resetToken = user.getResetToken();
    console.log("Token generated");

    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/pages/reset-password.html?token=${resetToken}`;


    await sendEmail(
      {
        to: user.email,
        subject: "Password Reset",
        html: `
        <p>Click below to reset password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        `
      }
    );

    res.status(200).json({ message: 'Reset link sent' });

  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({ message: 'Email could not be sent' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  try {
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    if(password.length < 8){
      return res.status(400).json({message: "Password must be at least 8 characters"});
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;

    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authorized" });

    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      isAdmin: req.user.isAdmin,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.uploadPhoto = async (req, res) =>{
  try{
    const user = req.user;
    const { image } = req.body;
    if(!image){
      return res.status(400).json({message: "Image is required"});
    }
    user.profileImage = image;
    await user.save();
    res.status(200).json({message: "Image uploaded successfully"});
  }catch(err){
    console.error("Upload photo error:", err);
    res.status(500).json({message: "Server error"});
  }
}

exports.removePhoto = async (req, res) =>{
  try{
    const user = req.user;
    user.profileImage = "";
    await user.save();
    res.status(200).json({message: "Image removed successfully"});
  }catch(err){
    console.error("Remove photo error:", err);
    res.status(500).json({message: "Image removal failed"});
  }
}

exports.resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        message: "If an account exists, a verification email has been sent"
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        message: "Account is already verified"
      });
    }

    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    user.verificationToken = hashedToken;
    user.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.API_URL}/api/auth/verify-email/${verificationToken}`;

    await sendEmail(
      {
        to: user.email,
        subject: "Verify Your Email",
        html: `
          <h2>Verify Your Email</h2>
          <p>Click below to verify your account:</p>
          <p><a href="${verificationUrl}">Verify Email</a></p>
          <p>This link expires in 24 hours.</p>
        `
      }
    );

    res.status(200).json({
      message: "If an account exists, a verification email has been sent"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Email could not be sent" });
  }
};