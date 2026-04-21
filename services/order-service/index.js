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

const DUMMY_ORDERS = [
  { _id: 'dummy-o-1',  product_id: 'dummy-inv-1',  quantity: 2, customer: 'Alice',    status: 'completed', created_at: new Date() },
  { _id: 'dummy-o-2',  product_id: 'dummy-inv-2',  quantity: 1, customer: 'Bob',      status: 'pending',   created_at: new Date() },
  { _id: 'dummy-o-3',  product_id: 'dummy-inv-3',  quantity: 5, customer: 'Charlie',  status: 'completed', created_at: new Date() },
  { _id: 'dummy-o-4',  product_id: 'dummy-inv-4',  quantity: 1, customer: 'Diana',    status: 'shipped',   created_at: new Date() },
  { _id: 'dummy-o-5',  product_id: 'dummy-inv-5',  quantity: 1, customer: 'Eve',      status: 'pending',   created_at: new Date() },
  { _id: 'dummy-o-6',  product_id: 'dummy-inv-6',  quantity: 3, customer: 'Frank',    status: 'completed', created_at: new Date() },
  { _id: 'dummy-o-7',  product_id: 'dummy-inv-7',  quantity: 2, customer: 'Grace',    status: 'shipped',   created_at: new Date() },
  { _id: 'dummy-o-8',  product_id: 'dummy-inv-8',  quantity: 1, customer: 'Henry',    status: 'pending',   created_at: new Date() },
  { _id: 'dummy-o-9',  product_id: 'dummy-inv-9',  quantity: 4, customer: 'Ivy',      status: 'completed', created_at: new Date() },
  { _id: 'dummy-o-10', product_id: 'dummy-inv-10', quantity: 10,customer: 'Jack',     status: 'shipped',   created_at: new Date() },
  { _id: 'dummy-o-11', product_id: 'dummy-inv-11', quantity: 2, customer: 'Kate',     status: 'pending',   created_at: new Date() },
  { _id: 'dummy-o-12', product_id: 'dummy-inv-12', quantity: 1, customer: 'Leo',      status: 'cancelled', created_at: new Date() },
  { _id: 'dummy-o-13', product_id: 'dummy-inv-13', quantity: 1, customer: 'Mia',      status: 'completed', created_at: new Date() },
  { _id: 'dummy-o-14', product_id: 'dummy-inv-14', quantity: 5, customer: 'Noah',     status: 'shipped',   created_at: new Date() },
  { _id: 'dummy-o-15', product_id: 'dummy-inv-15', quantity: 2, customer: 'Olivia',   status: 'pending',   created_at: new Date() },
  { _id: 'dummy-o-16', product_id: 'dummy-inv-16', quantity: 3, customer: 'Peter',    status: 'completed', created_at: new Date() },
  { _id: 'dummy-o-17', product_id: 'dummy-inv-17', quantity: 1, customer: 'Quinn',    status: 'shipped',   created_at: new Date() },
  { _id: 'dummy-o-18', product_id: 'dummy-inv-18', quantity: 2, customer: 'Rachel',   status: 'pending',   created_at: new Date() },
  { _id: 'dummy-o-19', product_id: 'dummy-inv-19', quantity: 1, customer: 'Sam',      status: 'completed', created_at: new Date() },
  { _id: 'dummy-o-20', product_id: 'dummy-inv-20', quantity: 1, customer: 'Tina',     status: 'shipped',   created_at: new Date() },
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
  const inventoryHealth = await fetchWithTimeout(`${INVENTORY_URL}/health`);
  res.json({
    service: 'order-service',
    status: 'OK',
    timestamp: new Date(),
    dependencies: {
      'inventory-service': inventoryHealth ? 'UP' : 'DOWN',
    },
  });
});

app.get('/api/orders', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('mongo-down');
    const orders = await Order.find();
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const product = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory/${order.product_id}`);
        return { ...order.toObject(), product: product || { error: 'inventory-service unavailable' } };
      })
    );
    res.json(enriched);
  } catch (err) {
    const enriched = await Promise.all(
      DUMMY_ORDERS.map(async (order) => {
        const product = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory/${order.product_id}`);
        return { ...order, product: product || { error: 'inventory-service unavailable' } };
      })
    );
    res.json(enriched);
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('mongo-down');
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const product = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory/${order.product_id}`);
    res.json({ ...order.toObject(), product: product || { error: 'inventory-service unavailable' } });
  } catch (err) {
    const dummy = DUMMY_ORDERS.find(o => o._id === req.params.id) || DUMMY_ORDERS[0];
    const product = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory/${dummy.product_id}`);
    res.json({ ...dummy, product: product || { error: 'inventory-service unavailable' } });
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
