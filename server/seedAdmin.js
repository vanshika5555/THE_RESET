/**
 * Creates or updates the admin account.
 *
 * Credentials come from environment variables so they are never
 * committed to the repo. Set them in server/.env first:
 *
 *   ADMIN_EMAIL=you@example.com
 *   ADMIN_PASSWORD=some-long-password
 *
 * Then run:  node seedAdmin.js
 *
 * Running it again with a new ADMIN_PASSWORD resets the password.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

const seedAdmin = async () => {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in your .env file.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Please use a password of at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email });

  if (existing) {
    existing.password = password;   // hashed by the User model on save
    existing.role = 'admin';
    await existing.save();
    console.log(`Password updated for existing admin: ${email}`);
  } else {
    await User.create({
      name: 'Admin',
      email,
      password,
      role: 'admin',
    });
    console.log(`Admin user created: ${email}`);
  }

  process.exit(0);
};

seedAdmin().catch(err => { console.error(err); process.exit(1); });