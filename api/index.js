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

const users = [];
const transactions = [];

// ─── Auth (демо: автосоздание пользователя) ───
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  let user = users.find(u => u.email === email);
  if (!user) {
    user = { id: uuidv4(), email };
    users.push(user);
  }
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'defaultsecret',
    { expiresIn: '1d' }
  );
  res.json({ token, user: { id: user.id, email: user.email } });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  const user = { id: uuidv4(), email };
  users.push(user);
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'defaultsecret',
    { expiresIn: '1d' }
  );
  res.json({ token, user: { id: user.id, email: user.email } });
});

// ─── Middleware ───
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');
      req.userId = payload.userId;
    } catch (err) {}
  }
  next();
}

// ─── Transactions ───
app.get('/api/transactions', authenticate, (req, res) => {
  if (!req.userId) return res.json([]);
  res.json(transactions.filter(tx => tx.userId === req.userId));
});

app.post('/api/transactions/manual', authenticate, (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Требуется авторизация' });
  const { type, baseCurrency, quoteCurrency, baseAmount, quoteAmount, fee, feeCurrency, timestamp, notes } = req.body;
  const tx = {
    id: uuidv4(),
    userId: req.userId,
    type,
    baseCurrency,
    quoteCurrency,
    baseAmount: Number(baseAmount),
    quoteAmount: Number(quoteAmount) || 0,
    fee: Number(fee) || 0,
    feeCurrency: feeCurrency || null,
    timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    notes: notes || '',
    createdAt: new Date().toISOString(),
  };
  transactions.push(tx);
  res.json(tx);
});

// ─── Portfolio (агрегация на основе транзакций) ───
app.get('/api/portfolio', authenticate, (req, res) => {
  if (!req.userId) return res.json({ holdings: {} });
  const userTxs = transactions.filter(tx => tx.userId === req.userId);
  const holdings = {};
  for (const tx of userTxs) {
    const cur = tx.baseCurrency;
    if (!holdings[cur]) holdings[cur] = { amount: 0, costBasis: 0 };
    const sign = (tx.type === 'BUY' || tx.type === 'SWAP_IN') ? 1 : -1;
    holdings[cur].amount += sign * tx.baseAmount;
    if (tx.type === 'BUY' || tx.type === 'SWAP_IN') {
      holdings[cur].costBasis += tx.quoteAmount;
    }
  }
  // Удалить валюты с нулевым остатком
  for (const cur of Object.keys(holdings)) {
    if (holdings[cur].amount <= 0) delete holdings[cur];
  }
  res.json({ holdings });
});

// Заглушки для остальных маршрутов (чтобы не было 404)
app.get('/api/portfolio/history', authenticate, (req, res) => res.json([]));
app.get('/api/portfolio/pnl', authenticate, (req, res) => res.json([]));
app.get('/api/portfolio/categories', authenticate, (req, res) => res.json([]));
app.post('/api/portfolio/categories', authenticate, (req, res) => res.json({ success: true }));
app.get('/api/tax/report/:year', authenticate, (req, res) => res.json({ events: [], summary: { totalProceeds: 0, totalCost: 0, totalGain: 0, totalTax: 0 } }));
app.get('/api/tax/report/:year/csv', authenticate, (req, res) => res.header('Content-Type', 'text/csv').send('date,currency,proceeds,costBasis,gainLoss,taxRate,taxAmount'));
app.get('/api/tax/report/:year/pdf', authenticate, (req, res) => res.json({ events: [], summary: {} }));
app.get('/api/tax/declaration/:year', authenticate, (req, res) => res.json({ year: req.params.year, totalIncome: 0, totalLoss: 0, taxableBase: 0, totalTax: 0, eventsCount: 0 }));
app.post('/api/exchanges/connect', authenticate, (req, res) => res.json({ success: true }));
app.get('/api/exchanges/list', authenticate, (req, res) => res.json([]));

module.exports = app;