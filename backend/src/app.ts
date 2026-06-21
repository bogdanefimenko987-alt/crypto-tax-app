import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './auth/routes';
import exchangeRoutes from './exchanges/routes';
import transactionRoutes from './transactions/routes';
import portfolioRoutes from './portfolio/routes';
import taxRoutes from './tax/routes';
import historyRoutes from './portfolio/historyRoutes';
import categoriesRoutes from './portfolio/categoriesRoutes';
// import './queue/syncExchange'; // отключено для Vercel

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/portfolio', historyRoutes);
app.use('/api/portfolio', categoriesRoutes);
app.use('/api/tax', taxRoutes);

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}

export default app;