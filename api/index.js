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

// ─── Auth (демо) ───
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  let user = users.find(u => u.email === email);
  if (!user) {
    user = { id: uuidv4(), email };
    users.push(user);
  }
  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'defaultsecret', { expiresIn: '1d' });
  res.json({ token, user: { id: user.id, email: user.email } });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  const user = { id: uuidv4(), email };
  users.push(user);
  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'defaultsecret', { expiresIn: '1d' });
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

// ─── Portfolio ───
app.get('/api/portfolio', authenticate, (req, res) => {
  if (!req.userId) return res.json({ holdings: {} });
  const userTxs = transactions.filter(tx => tx.userId === req.userId);
  const holdings = {};
  for (const tx of userTxs) {
    const cur = tx.baseCurrency;
    if (!holdings[cur]) holdings[cur] = { amount: 0, costBasis: 0 };
    const sign = (tx.type === 'BUY' || tx.type === 'SWAP_IN') ? 1 : -1;
    holdings[cur].amount += sign * tx.baseAmount;
    if (tx.type === 'BUY' || tx.type === 'SWAP_IN') holdings[cur].costBasis += tx.quoteAmount;
  }
  for (const cur of Object.keys(holdings)) {
    if (holdings[cur].amount <= 0) delete holdings[cur];
  }
  res.json({ holdings });
});

// ─── Portfolio History ───
app.get('/api/portfolio/history', authenticate, (req, res) => {
  if (!req.userId) return res.json([]);
  const userTxs = transactions.filter(tx => tx.userId === req.userId);
  userTxs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const balances = {};
  const history = [];
  for (const tx of userTxs) {
    const dateKey = new Date(tx.timestamp).toISOString().slice(0, 10);
    if (history.length === 0 || history[history.length - 1].date !== dateKey) {
      history.push({ date: dateKey });
    }
    const cur = tx.baseCurrency;
    const sign = (tx.type === 'BUY' || tx.type === 'SWAP_IN') ? 1 : -1;
    balances[cur] = (balances[cur] || 0) + sign * tx.baseAmount;
    const last = history[history.length - 1];
    for (const [c, bal] of Object.entries(balances)) {
      last[c] = Number(bal.toFixed(8));
    }
  }
  res.json(history);
});

// ─── PnL ───
app.get('/api/portfolio/pnl', authenticate, (req, res) => {
  if (!req.userId) return res.json([]);
  // Упрощённый расчёт PnL на основе продаж
  const sells = transactions.filter(tx => tx.userId === req.userId && (tx.type === 'SELL' || tx.type === 'SWAP_OUT'));
  const pnl = {};
  for (const tx of sells) {
    const cur = tx.baseCurrency;
    if (!pnl[cur]) pnl[cur] = { proceeds: 0, costBasis: 0, gainLoss: 0 };
    pnl[cur].proceeds += tx.quoteAmount;
    // Для себестоимости ищем соответствующую покупку (упрощённо: делим общую себестоимость на количество)
    const buys = transactions.filter(t => t.userId === req.userId && t.baseCurrency === cur && (t.type === 'BUY' || t.type === 'SWAP_IN'));
    const totalBought = buys.reduce((sum, b) => sum + b.baseAmount, 0);
    const totalCost = buys.reduce((sum, b) => sum + b.quoteAmount, 0);
    const avgCost = totalBought > 0 ? totalCost / totalBought : 0;
    pnl[cur].costBasis += avgCost * tx.baseAmount;
    pnl[cur].gainLoss += tx.quoteAmount - avgCost * tx.baseAmount;
  }
  res.json(Object.entries(pnl).map(([currency, data]) => ({ currency, ...data })));
});

// ─── Categories ───
const categories = {};
app.get('/api/portfolio/categories', authenticate, (req, res) => {
  res.json(Object.entries(categories).map(([currency, category]) => ({ id: currency, userId: req.userId, currency, category })));
});
app.post('/api/portfolio/categories', authenticate, (req, res) => {
  const { currency, category } = req.body;
  categories[currency] = category;
  res.json({ success: true });
});

// ─── Tax ───
app.get('/api/tax/report/:year', authenticate, (req, res) => {
  const sells = transactions.filter(tx => tx.userId === req.userId && (tx.type === 'SELL' || tx.type === 'SWAP_OUT'));
  const taxRate = 0.13;
  const events = sells.map(tx => {
    const buys = transactions.filter(t => t.userId === req.userId && t.baseCurrency === tx.baseCurrency && (t.type === 'BUY' || t.type === 'SWAP_IN'));
    const totalBought = buys.reduce((s, b) => s + b.baseAmount, 0);
    const totalCost = buys.reduce((s, b) => s + b.quoteAmount, 0);
    const avgCost = totalBought > 0 ? totalCost / totalBought : 0;
    const costBasis = avgCost * tx.baseAmount;
    const gain = tx.quoteAmount - costBasis;
    return {
      date: tx.timestamp,
      currency: tx.baseCurrency,
      proceeds: tx.quoteAmount,
      costBasis,
      gainLoss: gain,
      taxRate,
      taxAmount: gain * taxRate,
    };
  });
  const totalProceeds = events.reduce((s, e) => s + e.proceeds, 0);
  const totalCost = events.reduce((s, e) => s + e.costBasis, 0);
  const totalGain = totalProceeds - totalCost;
  const totalTax = totalGain * taxRate;
  res.json({ events, summary: { totalProceeds, totalCost, totalGain, totalTax } });
});
app.get('/api/tax/report/:year/csv', (req, res) => res.header('Content-Type', 'text/csv').send('date,currency,proceeds,costBasis,gainLoss,taxRate,taxAmount'));
app.get('/api/tax/report/:year/pdf', (req, res) => res.json({}));
app.get('/api/tax/declaration/:year', (req, res) => res.json({ totalIncome: 0, totalLoss: 0, totalTax: 0 }));

// ─── Exchanges ───
app.post('/api/exchanges/connect', authenticate, (req, res) => res.json({ success: true }));
app.get('/api/exchanges/list', authenticate, (req, res) => res.json([]));

module.exports = app;