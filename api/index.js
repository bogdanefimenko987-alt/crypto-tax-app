const express = require('express');
const bcrypt = require('bcryptjs');
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

const users = [];
const transactions = [];

// ─── Auth ───
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

// ─── Простой middleware (извлекает userId, но не блокирует при отсутствии токена) ───
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');
      req.userId = payload.userId;
    } catch (err) {
      // токен невалиден – оставляем req.userId = undefined
    }
  }
  next(); // всегда пропускаем запрос дальше
}

// ─── Transactions (защищены, но без токена вернут пустой массив) ───
app.get('/api/transactions', authenticate, (req, res) => {
  if (!req.userId) return res.json([]);
  res.json(transactions.filter(tx => tx.userId === req.userId));
});

app.post('/api/transactions/manual', authenticate, (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Требуется авторизация' });
  const tx = {
    id: uuidv4(),
    userId: req.userId,
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  transactions.push(tx);
  res.json(tx);
});

// ─── Portfolio / Tax / Categories (заглушки) ───
app.get('/api/portfolio', authenticate, (req, res) => res.json({ holdings: {} }));
app.get('/api/portfolio/history', authenticate, (req, res) => res.json([]));
app.get('/api/portfolio/pnl', authenticate, (req, res) => res.json([]));
app.get('/api/portfolio/categories', authenticate, (req, res) => res.json([]));
app.post('/api/portfolio/categories', authenticate, (req, res) => res.json({ success: true }));

app.get('/api/tax/report/:year', authenticate, (req, res) => res.json({ events: [], summary: { totalProceeds: 0, totalCost: 0, totalGain: 0, totalTax: 0 } }));
app.get('/api/tax/report/:year/csv', authenticate, (req, res) => res.header('Content-Type', 'text/csv').send('date,currency,proceeds,costBasis,gainLoss,taxRate,taxAmount'));
app.get('/api/tax/report/:year/pdf', authenticate, (req, res) => res.json({ events: [], summary: {} }));
app.get('/api/tax/declaration/:year', authenticate, (req, res) => res.json({ year: req.params.year, totalIncome: 0, totalLoss: 0, taxableBase: 0, totalTax: 0, eventsCount: 0 }));

app.post('/api/exchanges/connect', authenticate, (req, res) => res.json({ success: true, message: 'Биржа подключена (заглушка)' }));
app.get('/api/exchanges/list', authenticate, (req, res) => res.json([]));

module.exports = app;