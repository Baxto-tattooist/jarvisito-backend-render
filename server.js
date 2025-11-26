const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Endpoint de Health Check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint principal (opcional, pero útil)
app.get('/', (req, res) => {
  res.send('Jarvisito Backend is running.');
});

// Webhook de n8n (el backend lo necesita para recibir la URL)
app.post('/webhook/jarvisito', (req, res) => {
  console.log('Webhook de n8n recibido:', req.body);
  res.status(200).send('Webhook received');
});

app.listen(port, () => {
  console.log(`Jarvisito Backend listening on port ${port}`);
});
