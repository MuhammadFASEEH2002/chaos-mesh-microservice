const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://root:chaospass@mongodb:27017/inventory?authSource=admin';

app.use(express.json());

const itemSchema = new mongoose.Schema({
  name: String,
  stock: Number,
  price: Number,
});
const Item = mongoose.model('Item', itemSchema);

const seedData = [
  { name: 'Laptop', stock: 50, price: 999.99 },
  { name: 'Mouse', stock: 200, price: 29.99 },
  { name: 'Keyboard', stock: 150, price: 79.99 },
  { name: 'Monitor', stock: 30, price: 499.99 },
  { name: 'Headset', stock: 100, price: 59.99 },
];

async function seedDB() {
  const count = await Item.countDocuments();
  if (count === 0) {
    await Item.insertMany(seedData);
    console.log('Seeded inventory data');
  }
}

app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'UP' : 'DOWN';
  res.json({
    service: 'inventory-service',
    status: dbStatus === 'UP' ? 'OK' : 'DEGRADED',
    timestamp: new Date(),
    dependencies: { mongodb: dbStatus },
  });
});

app.get('/api/inventory', async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.get('/api/inventory/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

mongoose.connect(MONGO_URI).then(async () => {
  console.log('Connected to MongoDB');
  await seedDB();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Inventory service running on http://0.0.0.0:${port}`);
  });
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Inventory service running WITHOUT database on http://0.0.0.0:${port}`);
  });
});
