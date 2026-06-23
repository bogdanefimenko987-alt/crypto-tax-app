const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Ручная установка CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const users = [];
const transactions = [];

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const user = { id: uuidv4(), email, passwordHash: hash };
    users.push(user);
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions', (req, res) => res.json([]));
app.post('/api/transactions/manual', (req, res) => res.json({}));

module.exports = app;