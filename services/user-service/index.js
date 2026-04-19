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
    const users = await User.find().select('-recent_purchases');
    res.json(users);
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
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
    res.status(503).json({ error: 'Database unavailable' });
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
