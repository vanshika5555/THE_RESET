const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

const seedAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: 'admin@thereset.com' });
  if (existing) {
    console.log('Admin already exists');
    process.exit(0);
  }

  await User.create({
    name: 'Admin',
    email: 'admin@thereset.com',
    password: 'admin123',
    role: 'admin',
  });

  console.log('Admin user created: admin@thereset.com / admin123');
  process.exit(0);
};

seedAdmin().catch(err => { console.error(err); process.exit(1); });