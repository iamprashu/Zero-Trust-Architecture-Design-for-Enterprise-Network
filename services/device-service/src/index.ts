import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import nodemailer from 'nodemailer';
import { connectDB, Device, DeviceOtp, User } from '@repo/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // service-level .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // root .env fallback

const app = express();
app.use(express.json());
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5002').split(',');
const corsOptions = {
  origin: corsOrigins,
  allowedHeaders: ["Content-Type", "Authorization", "x-device-id"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});
// Connect DB
connectDB();

// ------------------------------------------------------------
// ADMIN API (to be consumed by Admin Panel via Gateway)
// ------------------------------------------------------------

app.get('/api/devices', async (req: Request, res: Response) => {
  try {
    const devices = await Device.find().populate('userId', 'email role');
    res.json({ success: true, devices });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/devices/:id/approve', async (req: Request, res: Response) => {
  try {
    const device = await Device.findByIdAndUpdate(
      req.params.id,
      { isTrusted: true, expiresAt: null },
      { new: true }
    );
    res.json({ success: true, device });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/devices/:id/revoke', async (req: Request, res: Response) => {
  try {
    const device = await Device.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Device revoked' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ------------------------------------------------------------
// MIDDLEWARE VERIFICATION API
// ------------------------------------------------------------

app.post('/api/devices/check', async (req: Request, res: Response) => {
  try {
    const { userId, deviceId } = req.body;

    if (!userId || !deviceId) {
      return res.status(400).json({ success: false, message: 'userId and deviceId required' });
    }

    // 1. Clean up expired devices for this user
    await Device.deleteMany({ userId, expiresAt: { $lt: new Date() } });

    // 2. Check if device exists
    const device = await Device.findOne({ userId, deviceId });

    if (!device) {
      // First time this device is seen for this user.
      // Is it their VERY FIRST device ever?
      const existingDevices = await Device.countDocuments({ userId });
      if (existingDevices === 0) {
        // Needs OTP for first login too, but we return 403 so the frontend triggers OTP flow.
        return res.status(403).json({ success: false, code: 'DEVICE_UNRECOGNIZED', isFirstLogin: true });
      }
      return res.status(403).json({ success: false, code: 'DEVICE_UNRECOGNIZED' });
    }

    // It exists. Is it expired? (should be cleaned up, but just in case)
    if (device.expiresAt && device.expiresAt < new Date()) {
      return res.status(403).json({ success: false, code: 'DEVICE_EXPIRED' });
    }

    res.json({ success: true, trusted: device.isTrusted, device });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ------------------------------------------------------------
// OTP FLOW API
// ------------------------------------------------------------

app.post('/api/devices/otp/request', async (req: Request, res: Response) => {
  try {
    const { userId, deviceId, deviceName } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save/Update OTP
    await DeviceOtp.findOneAndUpdate(
      { userId, deviceId },
      { otp, deviceName: deviceName || 'Unknown Device', expiresAt: new Date(Date.now() + 10 * 60000) },
      { upsert: true, new: true }
    );

    // For testing, log OTP to console
    console.log(`[DEVICE OTP] Generated OTP for ${user.email}: ${otp}`);

    // Send Email via Gmail
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"Zero Trust Security" <${process.env.EMAIL_USER}>`,
        to: user.email, // Send securely to the actual user
        subject: `Device Verification OTP for ${user.email}`,
        text: `Your OTP to login from a new device is ${otp}. It expires in 10 minutes.`,
      });
    } catch (mailErr: any) {
      console.error("Gmail send error:", mailErr.message);
      // Even if email fails, return success so user can check console for OTP
    }

    res.json({ success: true, message: 'OTP sent to your email.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/devices/otp/verify', async (req: Request, res: Response) => {
  try {
    const { userId, deviceId, otp } = req.body;

    const record = await DeviceOtp.findOne({ userId, deviceId });
    if (!record || record.otp !== otp || record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Delete OTP record
    await DeviceOtp.deleteOne({ _id: record._id });

    // Was this their very first device?
    const existingDevices = await Device.countDocuments({ userId });
    const isFirst = existingDevices === 0;

    // Create 5-hour session device
    const device = new Device({
      userId,
      deviceId,
      deviceName: record.deviceName,
      isTrusted: false, // Remains false until admin approves
      expiresAt: new Date(Date.now() + 5 * 3600000), // 5 hours
    });
    await device.save();

    // Send the notification email
    const user = await User.findById(userId);
    if (user) {
      await transporter.sendMail({
        from: '"Zero Trust Security" <no-reply@zerotrust.com>',
        to: user.email,
        subject: 'New Device Login Alert',
        text: `A new device has logged into your account. You have a 5-hour temporary session. If you did not authorize this, please contact your admin. Meanwhile, an admin will review and approve this device.`,
      });
    }

    res.json({ success: true, message: 'Device verified', device });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Device Service is listening on port ${PORT}`);
});
