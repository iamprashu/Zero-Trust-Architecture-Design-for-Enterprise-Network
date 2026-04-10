require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, User, Role, Permission } = require('@repo/db');
const routes = require('./routes');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Initialize MongoDB
connectDB();

const PORT = process.env.PORT || 5000;

// Superadmin Bootstrap
const bootstrapSuperadmin = async () => {
  try {
    const adminEmail = process.env.SUPERADMIN_EMAIL;
    const adminPassword = process.env.SUPERADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.log('Skipping superadmin setup: SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set.');
      return;
    }

    const existingAdmin = await User.findOne({ role: 'superadmin' });
    if (!existingAdmin) {
      console.log('No superadmin found. Creating from environment variables...');

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      const superAdminUser = new User({
        email: adminEmail,
        password: hashedPassword,
        role: 'superadmin',
        permissions: ['Z_ALL']
      });

      await superAdminUser.save();
      console.log('Superadmin created successfully.');
    } else {
      console.log('Superadmin already exists.');
    }
  } catch (error) {
    console.error('Error bootstrapping superadmin:', error);
  }
};

app.use('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'auth-service' }));
app.use('/api', routes);

app.listen(PORT, async () => {
  console.log(`Auth service running on port ${PORT}`);
  await bootstrapSuperadmin();
});
