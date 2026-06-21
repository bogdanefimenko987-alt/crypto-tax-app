import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
// import { processTransaction } from '../services/costBasisService';  // отключено для SQLite

const router = Router();
router.use(authenticate);

// Получить все транзакции пользователя
router.get('/', async (req: AuthRequest, res) => {
  const txs = await prisma.transaction.findMany({
    where: { userId: req.user!.id },
    orderBy: { timestamp: 'desc' },
  });
  res.json(txs);
});

// Ручное добавление транзакции (одиночная или своп)
router.post('/manual', async (req: AuthRequest, res) => {
  const { type, baseCurrency, quoteCurrency, baseAmount, quoteAmount, fee, feeCurrency, timestamp, notes,
          swapInCurrency, swapInAmount } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  // Обработка свопа
  if (type === 'SWAP') {
    if (!swapInCurrency || !swapInAmount) {
      return res.status(400).json({ error: 'Для свопа укажите валюту и количество получения' });
    }

    // SWAP_OUT (отдаём baseCurrency)
    const swapOut = await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        exchange: 'manual',
        type: 'SWAP_OUT',
        baseCurrency,
        quoteCurrency,
        baseAmount: -Math.abs(Number(baseAmount)),  // отрицательное число
        quoteAmount: Number(quoteAmount) || 0,
        fee: Number(fee) || 0,
        feeCurrency: feeCurrency || null,
        timestamp: new Date(timestamp),
        notes: notes ? `${notes} (SWAP_OUT)` : 'SWAP_OUT',
        manualEdit: true,
      },
    });

    // SWAP_IN (получаем swapInCurrency)
    const swapIn = await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        exchange: 'manual',
        type: 'SWAP_IN',
        baseCurrency: swapInCurrency,
        quoteCurrency,
        baseAmount: Math.abs(Number(swapInAmount)), // положительное число
        quoteAmount: Number(quoteAmount) || 0,
        fee: null,
        feeCurrency: null,
        timestamp: new Date(timestamp),
        notes: notes ? `${notes} (SWAP_IN)` : 'SWAP_IN',
        manualEdit: true,
      },
    });

    // Создание лотов и налоговых событий временно отключено
    // await processTransaction(swapOut, user);
    // await processTransaction(swapIn, user);

    return res.json({ swapOut, swapIn });
  }

  // Обычная транзакция (BUY / SELL)
  const tx = await prisma.transaction.create({
    data: {
      userId: req.user!.id,
      exchange: 'manual',
      type,
      baseCurrency,
      quoteCurrency,
      baseAmount: (type === 'SELL' || type === 'SWAP_OUT')
        ? -Math.abs(Number(baseAmount))
        : Math.abs(Number(baseAmount)),
      quoteAmount: Number(quoteAmount) || 0,
      fee: Number(fee) || 0,
      feeCurrency: feeCurrency || null,
      timestamp: new Date(timestamp),
      notes,
      manualEdit: true,
    },
  });

  // Создание лотов и налоговых событий временно отключено
  // await processTransaction(tx, user);

  res.json(tx);
});

// Редактирование ручной транзакции
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const oldTx = await prisma.transaction.findFirst({
    where: { id, userId: req.user!.id, manualEdit: true },
  });
  if (!oldTx) return res.status(404).json({ error: 'Не найдена' });

  // Удаляем старую транзакцию (без пересчёта лотов)
  await prisma.transaction.delete({ where: { id } });

  const { type, baseCurrency, quoteCurrency, baseAmount, quoteAmount, fee, feeCurrency, timestamp, notes } = req.body;
  const newTx = await prisma.transaction.create({
    data: {
      userId: req.user!.id,
      exchange: 'manual',
      type,
      baseCurrency,
      quoteCurrency,
      baseAmount: (type === 'SELL' || type === 'SWAP_OUT')
        ? -Math.abs(Number(baseAmount))
        : Math.abs(Number(baseAmount)),
      quoteAmount: Number(quoteAmount) || 0,
      fee: Number(fee) || 0,
      feeCurrency: feeCurrency || null,
      timestamp: new Date(timestamp),
      notes,
      manualEdit: true,
    },
  });

  // Пересчёт лотов временно отключён
  // await processTransaction(newTx, user);

  res.json(newTx);
});

export default router;