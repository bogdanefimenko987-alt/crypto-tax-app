import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import authRoutes from './auth/routes';
import exchangeRoutes from './exchanges/routes';
import transactionRoutes from './transactions/routes';
import portfolioRoutes from './portfolio/routes';
import taxRoutes from './tax/routes';
import historyRoutes from './portfolio/historyRoutes';
import categoriesRoutes from './portfolio/categoriesRoutes';
// import './queue/syncExchange'; // отключено

const app = express();

// ────────────────────────────────────
// Явная установка CORS заголовков
// ────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight запрос
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Остальные middleware
app.use(helmet());
app.use(express.json());

// Маршруты
app.use('/api/auth', authRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/portfolio', historyRoutes);
app.use('/api/portfolio', categoriesRoutes);
app.use('/api/tax', taxRoutes);

// Локальный запуск (не на Vercel)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}

export default app;