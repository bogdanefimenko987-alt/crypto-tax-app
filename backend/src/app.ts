import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import authRoutes from './auth/routes';
import transactionRoutes from './transactions/routes';

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

app.use(helmet());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

export default app;