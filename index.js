const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.get('/api/message', (req, res) => {
  res.json({ message: 'Node.js Microservice is running successfully!' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Microservice running on http://0.0.0.0:${port}`);
});
