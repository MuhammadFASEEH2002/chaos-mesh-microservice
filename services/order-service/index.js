const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://root:chaospass@mongodb:27017/orders?authSource=admin';
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || 'http://inventory-service';

app.use(express.json());

const orderSchema = new mongoose.Schema({
  product_id: String,
  quantity: Number,
  customer: String,
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now },
});
const Order = mongoose.model('Order', orderSchema);

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
  const count = await Order.countDocuments();
  if (count === 0) {
    const inventory = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory`);
    const productIds = inventory ? inventory.map(i => i._id) : ['unknown'];

    await Order.insertMany([
      { product_id: productIds[0] || 'unknown', quantity: 2, customer: 'Alice', status: 'completed' },
      { product_id: productIds[2] || 'unknown', quantity: 1, customer: 'Bob', status: 'pending' },
      { product_id: productIds[1] || 'unknown', quantity: 5, customer: 'Charlie', status: 'completed' },
      { product_id: productIds[4] || 'unknown', quantity: 1, customer: 'Diana', status: 'shipped' },
      { product_id: productIds[3] || 'unknown', quantity: 1, customer: 'Eve', status: 'pending' },
    ]);
    console.log('Seeded order data');
  }
}

app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'UP' : 'DOWN';
  const inventoryHealth = await fetchWithTimeout(`${INVENTORY_URL}/health`);
  res.json({
    service: 'order-service',
    status: dbStatus === 'UP' ? 'OK' : 'DEGRADED',
    timestamp: new Date(),
    dependencies: {
      mongodb: dbStatus,
      'inventory-service': inventoryHealth ? 'UP' : 'DOWN',
    },
  });
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find();
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const product = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory/${order.product_id}`);
        return { ...order.toObject(), product: product || { error: 'inventory-service unavailable' } };
      })
    );
    res.json(enriched);
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const product = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory/${order.product_id}`);
    res.json({ ...order.toObject(), product: product || { error: 'inventory-service unavailable' } });
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

mongoose.connect(MONGO_URI).then(async () => {
  console.log('Connected to MongoDB');
  await seedDB();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Order service running on http://0.0.0.0:${port}`);
  });
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Order service running WITHOUT database on http://0.0.0.0:${port}`);
  });
});
