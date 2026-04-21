const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://root:chaospass@mongodb:27017/users?authSource=admin';
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || 'http://inventory-service';

app.use(express.json());

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  recent_purchases: [String],
});
const User = mongoose.model('User', userSchema);

const DUMMY_USERS = [
  { _id: 'dummy-u-1',  name: 'Alice',    email: 'alice@example.com',    recent_purchases: ['dummy-inv-1', 'dummy-inv-3'] },
  { _id: 'dummy-u-2',  name: 'Bob',      email: 'bob@example.com',      recent_purchases: ['dummy-inv-2'] },
  { _id: 'dummy-u-3',  name: 'Charlie',  email: 'charlie@example.com',  recent_purchases: ['dummy-inv-4', 'dummy-inv-5'] },
  { _id: 'dummy-u-4',  name: 'Diana',    email: 'diana@example.com',    recent_purchases: ['dummy-inv-1'] },
  { _id: 'dummy-u-5',  name: 'Eve',      email: 'eve@example.com',      recent_purchases: ['dummy-inv-2', 'dummy-inv-3', 'dummy-inv-5'] },
  { _id: 'dummy-u-6',  name: 'Frank',    email: 'frank@example.com',    recent_purchases: ['dummy-inv-6'] },
  { _id: 'dummy-u-7',  name: 'Grace',    email: 'grace@example.com',    recent_purchases: ['dummy-inv-7', 'dummy-inv-8'] },
  { _id: 'dummy-u-8',  name: 'Henry',    email: 'henry@example.com',    recent_purchases: ['dummy-inv-9'] },
  { _id: 'dummy-u-9',  name: 'Ivy',      email: 'ivy@example.com',      recent_purchases: ['dummy-inv-10', 'dummy-inv-11'] },
  { _id: 'dummy-u-10', name: 'Jack',     email: 'jack@example.com',     recent_purchases: ['dummy-inv-12'] },
  { _id: 'dummy-u-11', name: 'Kate',     email: 'kate@example.com',     recent_purchases: ['dummy-inv-13', 'dummy-inv-14'] },
  { _id: 'dummy-u-12', name: 'Leo',      email: 'leo@example.com',      recent_purchases: ['dummy-inv-15'] },
  { _id: 'dummy-u-13', name: 'Mia',      email: 'mia@example.com',      recent_purchases: ['dummy-inv-16', 'dummy-inv-17'] },
  { _id: 'dummy-u-14', name: 'Noah',     email: 'noah@example.com',     recent_purchases: ['dummy-inv-18'] },
  { _id: 'dummy-u-15', name: 'Olivia',   email: 'olivia@example.com',   recent_purchases: ['dummy-inv-19', 'dummy-inv-20'] },
  { _id: 'dummy-u-16', name: 'Peter',    email: 'peter@example.com',    recent_purchases: ['dummy-inv-1', 'dummy-inv-10'] },
  { _id: 'dummy-u-17', name: 'Quinn',    email: 'quinn@example.com',    recent_purchases: ['dummy-inv-5'] },
  { _id: 'dummy-u-18', name: 'Rachel',   email: 'rachel@example.com',   recent_purchases: ['dummy-inv-7', 'dummy-inv-15'] },
  { _id: 'dummy-u-19', name: 'Sam',      email: 'sam@example.com',      recent_purchases: ['dummy-inv-3', 'dummy-inv-8', 'dummy-inv-12'] },
  { _id: 'dummy-u-20', name: 'Tina',     email: 'tina@example.com',     recent_purchases: ['dummy-inv-20'] },
];

async function fetchWithTimeout(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function seedDB() {
  const count = await User.countDocuments();
  if (count === 0) {
    const inventory = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory`);
    const productIds = inventory ? inventory.map(i => i._id) : [];

    await User.insertMany([
      { name: 'Alice', email: 'alice@example.com', recent_purchases: [productIds[0], productIds[2]].filter(Boolean) },
      { name: 'Bob', email: 'bob@example.com', recent_purchases: [productIds[1]].filter(Boolean) },
      { name: 'Charlie', email: 'charlie@example.com', recent_purchases: [productIds[3], productIds[4]].filter(Boolean) },
      { name: 'Diana', email: 'diana@example.com', recent_purchases: [productIds[0]].filter(Boolean) },
      { name: 'Eve', email: 'eve@example.com', recent_purchases: [productIds[1], productIds[2], productIds[4]].filter(Boolean) },
    ]);
    console.log('Seeded user data');
  }
}

app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'UP' : 'DOWN';
  const inventoryHealth = await fetchWithTimeout(`${INVENTORY_URL}/health`);
  res.json({
    service: 'user-service',
    status: dbStatus === 'UP' ? 'OK' : 'DEGRADED',
    timestamp: new Date(),
    dependencies: {
      mongodb: dbStatus,
      'inventory-service': inventoryHealth ? 'UP' : 'DOWN',
    },
  });
});

app.get('/api/users', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('mongo-down');
    const users = await User.find().select('-recent_purchases');
    res.json(users);
  } catch (err) {
    res.json(DUMMY_USERS.map(({ recent_purchases, ...rest }) => rest));
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('mongo-down');
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const purchases = await Promise.all(
      user.recent_purchases.map(async (productId) => {
        const product = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory/${productId}`);
        return product || { _id: productId, error: 'inventory-service unavailable' };
      })
    );
    res.json({ ...user.toObject(), recent_purchases: purchases });
  } catch (err) {
    const dummy = DUMMY_USERS.find(u => u._id === req.params.id) || DUMMY_USERS[0];
    const purchases = await Promise.all(
      dummy.recent_purchases.map(async (productId) => {
        const product = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory/${productId}`);
        return product || { _id: productId, error: 'inventory-service unavailable' };
      })
    );
    res.json({ ...dummy, recent_purchases: purchases });
  }
});

mongoose.connect(MONGO_URI).then(async () => {
  console.log('Connected to MongoDB');
  await seedDB();
  app.listen(port, '0.0.0.0', () => {
    console.log(`User service running on http://0.0.0.0:${port}`);
  });
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
  app.listen(port, '0.0.0.0', () => {
    console.log(`User service running WITHOUT database on http://0.0.0.0:${port}`);
  });
});
