const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Демо-логин
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  const user = { id: uuidv4(), email };
  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'defaultsecret', { expiresIn: '1d' });
  res.json({ token, user: { id: user.id, email: user.email } });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  const user = { id: uuidv4(), email };
  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'defaultsecret', { expiresIn: '1d' });
  res.json({ token, user: { id: user.id, email: user.email } });
});

module.exports = app;