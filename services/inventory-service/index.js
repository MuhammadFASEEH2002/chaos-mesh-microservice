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
  { name: 'Laptop',       stock: 50,  price: 999.99 },
  { name: 'Mouse',        stock: 200, price: 29.99  },
  { name: 'Keyboard',     stock: 150, price: 79.99  },
  { name: 'Monitor',      stock: 30,  price: 499.99 },
  { name: 'Headset',      stock: 100, price: 59.99  },
  { name: 'Webcam',       stock: 80,  price: 89.99  },
  { name: 'Microphone',   stock: 60,  price: 129.99 },
  { name: 'Speakers',     stock: 70,  price: 149.99 },
  { name: 'USB Hub',      stock: 300, price: 19.99  },
  { name: 'HDMI Cable',   stock: 400, price: 12.99  },
  { name: 'Charger',      stock: 250, price: 24.99  },
  { name: 'Power Bank',   stock: 120, price: 39.99  },
  { name: 'Tablet',       stock: 40,  price: 399.99 },
  { name: 'Stylus',       stock: 180, price: 49.99  },
  { name: 'Laptop Case',  stock: 90,  price: 34.99  },
  { name: 'Backpack',     stock: 110, price: 69.99  },
  { name: 'Monitor Stand',stock: 75,  price: 44.99  },
  { name: 'Desk Lamp',    stock: 85,  price: 54.99  },
  { name: 'Office Chair', stock: 25,  price: 249.99 },
  { name: 'Standing Desk',stock: 15,  price: 599.99 },
];

const DUMMY_INVENTORY = seedData.map((item, i) => ({
  _id: `dummy-inv-${i + 1}`,
  ...item,
}));

async function seedDB() {
  const count = await Item.countDocuments();
  if (count === 0) {
    await Item.insertMany(seedData);
    console.log('Seeded inventory data');
  }
}

app.get('/health', async (req, res) => {
  res.json({
    service: 'inventory-service',
    status: 'OK',
    timestamp: new Date(),
  });
});

app.get('/api/inventory', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('mongo-down');
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.json(DUMMY_INVENTORY);
  }
});

app.get('/api/inventory/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('mongo-down');
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    const dummy = DUMMY_INVENTORY.find(i => i._id === req.params.id) || DUMMY_INVENTORY[0];
    res.json(dummy);
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
