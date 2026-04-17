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
app.use(express.urlencoded({ extended: true }));
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

const bootstrapSeedData = async () => {
  try {
    const permissions = [
      { name: 'READ_TRANSACTION', description: 'Can read transactions' },
      { name: 'CREATE_TRANSACTION', description: 'Can create transactions' },
      { name: 'READ_ACCOUNT', description: 'Can read account details' },
      { name: 'TRANSFER_MONEY', description: 'Can transfer money' },
      { name: 'CREATE_ACCOUNT', description: 'Can create user accounts' },
      { name: 'EDIT_ACCOUNT', description: 'Can edit user accounts' },
      { name: 'DELETE_ACCOUNT', description: 'Can delete user accounts' },
      { name: 'CREATE_LOAN_TRANSACTION', description: 'Can create loan transactions' }
    ];

    for (const p of permissions) {
      await Permission.updateOne({ name: p.name }, { $set: p }, { upsert: true });
    }

    const adminRole = await Role.findOneAndUpdate(
      { name: 'admin' },
      { $set: { permissions: permissions.map(p => p.name) } },
      { upsert: true, new: true }
    );

    const managerRole = await Role.findOneAndUpdate(
      { name: 'manager' },
      { $set: { permissions: ['READ_TRANSACTION', 'CREATE_TRANSACTION', 'READ_ACCOUNT', 'TRANSFER_MONEY', 'CREATE_ACCOUNT', 'EDIT_ACCOUNT', 'DELETE_ACCOUNT', 'CREATE_LOAN_TRANSACTION'] } },
      { upsert: true, new: true }
    );

    const loanManagerRole = await Role.findOneAndUpdate(
      { name: 'loan_manager' },
      { $set: { permissions: ['READ_ACCOUNT', 'READ_TRANSACTION', 'CREATE_LOAN_TRANSACTION'] } },
      { upsert: true, new: true }
    );

    const branchManagerRole = await Role.findOneAndUpdate(
      { name: 'branch_manager' },
      { $set: { permissions: ['READ_TRANSACTION', 'CREATE_TRANSACTION', 'READ_ACCOUNT', 'TRANSFER_MONEY', 'CREATE_ACCOUNT', 'EDIT_ACCOUNT', 'CREATE_LOAN_TRANSACTION'] } },
      { upsert: true, new: true }
    );

    const tellerRole = await Role.findOneAndUpdate(
      { name: 'teller' },
      { $set: { permissions: ['READ_ACCOUNT', 'CREATE_TRANSACTION', 'TRANSFER_MONEY'] } },
      { upsert: true, new: true }
    );

    const userRole = await Role.findOneAndUpdate(
      { name: 'user' },
      { $set: { permissions: ['READ_TRANSACTION', 'READ_ACCOUNT', 'TRANSFER_MONEY'] } },
      { upsert: true, new: true }
    );

    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('password123', salt);

    await User.updateOne(
      { email: 'admin@bank.local' },
      { $setOnInsert: { password, role: 'admin' } },
      { upsert: true }
    );

    await User.updateOne(
      { email: 'manager@bank.local' },
      { $setOnInsert: { password, role: 'manager' } },
      { upsert: true }
    );

    await User.updateOne(
      { email: 'loan_manager@bank.local' },
      { $setOnInsert: { password, role: 'loan_manager' } },
      { upsert: true }
    );

    await User.updateOne(
      { email: 'branch_manager@bank.local' },
      { $setOnInsert: { password, role: 'branch_manager' } },
      { upsert: true }
    );

    await User.updateOne(
      { email: 'teller@bank.local' },
      { $setOnInsert: { password, role: 'teller' } },
      { upsert: true }
    );

    await User.updateOne(
      { email: 'user@bank.local' },
      { $setOnInsert: { password, role: 'user' } },
      { upsert: true }
    );
    console.log('Seed data initialized (Roles, Permissions, sample users).');
  } catch (error) {
    console.error('Error bootstrapping seed data:', error);
  }
};

app.listen(PORT, async () => {
  console.log(`Auth service running on port ${PORT}`);
  await bootstrapSuperadmin();
  await bootstrapSeedData();
});
