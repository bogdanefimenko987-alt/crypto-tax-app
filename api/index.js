const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const users = [];
const categories = {};

// Демо-транзакции
const transactions = [
  {
    id: uuidv4(), userId: 'demo-user', type: 'BUY',
    baseCurrency: 'BTC', quoteCurrency: 'USDT',
    baseAmount: 0.5, quoteAmount: 25000,
    fee: 10, feeCurrency: 'USDT',
    timestamp: '2026-01-15T10:00:00.000Z', notes: 'Демо-покупка',
    createdAt: '2026-01-15T10:00:00.000Z'
  },
  {
    id: uuidv4(), userId: 'demo-user', type: 'BUY',
    baseCurrency: 'ETH', quoteCurrency: 'USDT',
    baseAmount: 2, quoteAmount: 4000,
    fee: 5, feeCurrency: 'USDT',
    timestamp: '2026-02-10T12:00:00.000Z', notes: 'Демо-покупка',
    createdAt: '2026-02-10T12:00:00.000Z'
  },
  {
    id: uuidv4(), userId: 'demo-user', type: 'SELL',
    baseCurrency: 'BTC', quoteCurrency: 'USDT',
    baseAmount: 0.2, quoteAmount: 12000,
    fee: 3, feeCurrency: 'USDT',
    timestamp: '2026-03-20T14:00:00.000Z', notes: 'Демо-продажа',
    createdAt: '2026-03-20T14:00:00.000Z'
  }
];

// --- Auth (демо-режим – все пользователи получают demo-user) ---
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  const token = jwt.sign({ userId: 'demo-user', email }, process.env.JWT_SECRET || 'default', { expiresIn: '1d' });
  res.json({ token, user: { id: 'demo-user', email } });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  const token = jwt.sign({ userId: 'demo-user', email }, process.env.JWT_SECRET || 'default', { expiresIn: '1d' });
  res.json({ token, user: { id: 'demo-user', email } });
});

// --- Middleware ---
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) {
    try { req.userId = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET || 'default').userId; } catch {}
  }
  next();
}

// --- Transactions ---
app.get('/api/transactions', auth, (req, res) => {
  res.json(req.userId ? transactions.filter(t => t.userId === req.userId) : []);
});
app.post('/api/transactions/manual', auth, (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Требуется авторизация' });
  const { type, baseCurrency, quoteCurrency, baseAmount, quoteAmount, fee, feeCurrency, timestamp, notes } = req.body;
  const tx = {
    id: uuidv4(), userId: req.userId, type, baseCurrency, quoteCurrency,
    baseAmount: Number(baseAmount), quoteAmount: Number(quoteAmount) || 0,
    fee: Number(fee) || 0, feeCurrency: feeCurrency || null,
    timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    notes: notes || '', createdAt: new Date().toISOString()
  };
  transactions.push(tx);
  res.json(tx);
});

// --- Portfolio ---
app.get('/api/portfolio', auth, (req, res) => {
  if (!req.userId) return res.json({ holdings: {} });
  const txs = transactions.filter(t => t.userId === req.userId);
  const h = {};
  for (const t of txs) {
    const c = t.baseCurrency;
    if (!h[c]) h[c] = { amount: 0, costBasis: 0 };
    const sign = (t.type === 'BUY' || t.type === 'SWAP_IN') ? 1 : -1;
    h[c].amount += sign * t.baseAmount;
    if (t.type === 'BUY' || t.type === 'SWAP_IN') h[c].costBasis += t.quoteAmount;
  }
  Object.keys(h).forEach(c => { if (h[c].amount <= 0) delete h[c]; });
  res.json({ holdings: h });
});

// --- History ---
app.get('/api/portfolio/history', auth, (req, res) => {
  if (!req.userId) return res.json([]);
  const txs = transactions.filter(t => t.userId === req.userId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const bal = {}, hist = [];
  for (const t of txs) {
    const dk = new Date(t.timestamp).toISOString().slice(0, 10);
    if (!hist.length || hist[hist.length - 1].date !== dk) hist.push({ date: dk });
    const sign = (t.type === 'BUY' || t.type === 'SWAP_IN') ? 1 : -1;
    bal[t.baseCurrency] = (bal[t.baseCurrency] || 0) + sign * t.baseAmount;
    const last = hist[hist.length - 1];
    for (const [c, v] of Object.entries(bal)) last[c] = Number(v.toFixed(8));
  }
  res.json(hist);
});

// --- PnL ---
app.get('/api/portfolio/pnl', auth, (req, res) => {
  if (!req.userId) return res.json([]);
  const sells = transactions.filter(t => t.userId === req.userId && (t.type === 'SELL' || t.type === 'SWAP_OUT'));
  const pnl = {};
  for (const t of sells) {
    const c = t.baseCurrency;
    if (!pnl[c]) pnl[c] = { proceeds: 0, costBasis: 0, gainLoss: 0 };
    pnl[c].proceeds += t.quoteAmount;
    const buys = transactions.filter(b => b.userId === req.userId && b.baseCurrency === c && (b.type === 'BUY' || b.type === 'SWAP_IN'));
    const totalBought = buys.reduce((s, b) => s + b.baseAmount, 0);
    const totalCost = buys.reduce((s, b) => s + b.quoteAmount, 0);
    const avgCost = totalBought ? totalCost / totalBought : 0;
    pnl[c].costBasis += avgCost * t.baseAmount;
    pnl[c].gainLoss += t.quoteAmount - avgCost * t.baseAmount;
  }
  res.json(Object.entries(pnl).map(([cur, data]) => ({ currency: cur, ...data })));
});

// --- Categories ---
app.get('/api/portfolio/categories', auth, (req, res) => {
  res.json(Object.keys(categories).map(currency => ({
    id: currency, userId: req.userId, currency, category: categories[currency]
  })));
});
app.post('/api/portfolio/categories', auth, (req, res) => {
  const { currency, category } = req.body;
  if (currency && category) categories[currency] = category;
  res.json({ success: true });
});

// --- Tax ---
app.get('/api/tax/report/:year', auth, (req, res) => {
  const sells = transactions.filter(t => t.userId === req.userId && (t.type === 'SELL' || t.type === 'SWAP_OUT'));
  const rate = 0.13;
  const events = sells.map(t => {
    const buys = transactions.filter(b => b.userId === req.userId && b.baseCurrency === t.baseCurrency && (b.type === 'BUY' || b.type === 'SWAP_IN'));
    const totalBought = buys.reduce((s, b) => s + b.baseAmount, 0);
    const totalCost = buys.reduce((s, b) => s + b.quoteAmount, 0);
    const avgCost = totalBought ? totalCost / totalBought : 0;
    const cost = avgCost * t.baseAmount;
    const gain = t.quoteAmount - cost;
    return { date: t.timestamp, currency: t.baseCurrency, proceeds: t.quoteAmount, costBasis: cost, gainLoss: gain, taxRate: rate, taxAmount: gain * rate };
  });
  const tp = events.reduce((s, e) => s + e.proceeds, 0);
  const tc = events.reduce((s, e) => s + e.costBasis, 0);
  const tg = tp - tc;
  res.json({ events, summary: { totalProceeds: tp, totalCost: tc, totalGain: tg, totalTax: tg * rate } });
});

// CSV
app.get('/api/tax/report/:year/csv', auth, (req, res) => {
  const sells = transactions.filter(t => t.userId === req.userId && (t.type === 'SELL' || t.type === 'SWAP_OUT'));
  const rate = 0.13;
  const rows = sells.map(t => {
    const buys = transactions.filter(b => b.userId === req.userId && b.baseCurrency === t.baseCurrency && (b.type === 'BUY' || b.type === 'SWAP_IN'));
    const totalBought = buys.reduce((s, b) => s + b.baseAmount, 0);
    const totalCost = buys.reduce((s, b) => s + b.quoteAmount, 0);
    const avgCost = totalBought ? totalCost / totalBought : 0;
    const cost = avgCost * t.baseAmount;
    const gain = t.quoteAmount - cost;
    return {
      date: t.timestamp.slice(0, 10),
      currency: t.baseCurrency,
      proceeds: t.quoteAmount.toFixed(2),
      costBasis: cost.toFixed(2),
      gainLoss: gain.toFixed(2),
      taxRate: rate,
      taxAmount: (gain * rate).toFixed(2)
    };
  });
  const header = 'date,currency,proceeds,costBasis,gainLoss,taxRate,taxAmount';
  const csv = header + '\n' + rows.map(r => Object.values(r).join(',')).join('\n');
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`tax-report-${req.params.year}.csv`);
  res.send(csv);
});

// PDF (заглушка)
app.get('/api/tax/report/:year/pdf', auth, (req, res) => {
  res.header('Content-Type', 'application/pdf');
  res.attachment(`tax-report-${req.params.year}.pdf`);
  res.send('PDF будет доступен позже');
});

app.get('/api/tax/declaration/:year', auth, (req, res) => {
  res.json({ totalIncome: 0, totalLoss: 0, totalTax: 0 });
});

// --- Exchanges ---
app.post('/api/exchanges/connect', auth, (req, res) => res.json({ success: true }));
app.get('/api/exchanges/list', auth, (req, res) => res.json([]));

module.exports = app;