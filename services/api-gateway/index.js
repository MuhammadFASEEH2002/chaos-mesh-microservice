const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const ORDER_URL = process.env.ORDER_SERVICE_URL || 'http://order-service';
const USER_URL = process.env.USER_SERVICE_URL || 'http://user-service';
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || 'http://inventory-service';

app.use(express.json());

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

app.get('/health', async (req, res) => {
  const [orderHealth, userHealth, inventoryHealth] = await Promise.all([
    fetchWithTimeout(`${ORDER_URL}/health`),
    fetchWithTimeout(`${USER_URL}/health`),
    fetchWithTimeout(`${INVENTORY_URL}/health`),
  ]);

  const allUp = orderHealth && userHealth && inventoryHealth;
  res.json({
    service: 'api-gateway',
    status: allUp ? 'OK' : 'DEGRADED',
    timestamp: new Date(),
    dependencies: {
      'order-service': orderHealth ? 'UP' : 'DOWN',
      'user-service': userHealth ? 'UP' : 'DOWN',
      'inventory-service': inventoryHealth ? 'UP' : 'DOWN',
    },
  });
});

app.get('/api/status', async (req, res) => {
  const start = Date.now();
  const [orderHealth, userHealth, inventoryHealth] = await Promise.all([
    fetchWithTimeout(`${ORDER_URL}/health`),
    fetchWithTimeout(`${USER_URL}/health`),
    fetchWithTimeout(`${INVENTORY_URL}/health`),
  ]);
  const duration = Date.now() - start;

  res.json({
    service: 'api-gateway',
    response_time_ms: duration,
    timestamp: new Date(),
    services: {
      'order-service': orderHealth || { status: 'DOWN' },
      'user-service': userHealth || { status: 'DOWN' },
      'inventory-service': inventoryHealth || { status: 'DOWN' },
    },
  });
});

app.get('/api/orders', async (req, res) => {
  const data = await fetchWithTimeout(`${ORDER_URL}/api/orders`);
  if (!data) return res.status(503).json({ error: 'order-service unavailable' });
  res.json(data);
});

app.get('/api/orders/:id', async (req, res) => {
  const data = await fetchWithTimeout(`${ORDER_URL}/api/orders/${req.params.id}`);
  if (!data) return res.status(503).json({ error: 'order-service unavailable' });
  res.json(data);
});

app.get('/api/users', async (req, res) => {
  const data = await fetchWithTimeout(`${USER_URL}/api/users`);
  if (!data) return res.status(503).json({ error: 'user-service unavailable' });
  res.json(data);
});

app.get('/api/users/:id', async (req, res) => {
  const data = await fetchWithTimeout(`${USER_URL}/api/users/${req.params.id}`);
  if (!data) return res.status(503).json({ error: 'user-service unavailable' });
  res.json(data);
});

app.get('/api/inventory', async (req, res) => {
  const data = await fetchWithTimeout(`${INVENTORY_URL}/api/inventory`);
  if (!data) return res.status(503).json({ error: 'inventory-service unavailable' });
  res.json(data);
});

app.get('/api/message', (req, res) => {
  res.json({ message: 'Chaos Mesh Microservice System is running!' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API Gateway running on http://0.0.0.0:${port}`);
});
