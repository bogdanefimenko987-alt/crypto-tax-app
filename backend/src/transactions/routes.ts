import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { processTransaction } from '../services/costBasisService';
import { Decimal } from 'decimal.js';

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
    // Проверка обязательных полей для свопа
    if (!swapInCurrency || !swapInAmount) {
      return res.status(400).json({ error: 'Для свопа укажите валюту и количество получения (swapInCurrency, swapInAmount)' });
    }

    // Создаём SWAP_OUT (продажа baseCurrency)
    const swapOut = await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        exchange: 'manual',
        type: 'SWAP_OUT',
        baseCurrency,
        quoteCurrency,       // валюта расчёта (например, USDT)
        baseAmount: new Decimal(baseAmount).negated(), // отдаём
        quoteAmount: quoteAmount ? new Decimal(quoteAmount) : null,
        fee: fee ? new Decimal(fee) : null,
        feeCurrency: feeCurrency || null,
        timestamp: new Date(timestamp),
        notes: notes ? `${notes} (SWAP_OUT)` : 'SWAP_OUT',
        manualEdit: true,
      },
    });

    // Создаём SWAP_IN (покупка swapInCurrency)
    const swapIn = await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        exchange: 'manual',
        type: 'SWAP_IN',
        baseCurrency: swapInCurrency,
        quoteCurrency,       // та же валюта расчёта
        baseAmount: new Decimal(swapInAmount), // получаем
        quoteAmount: quoteAmount ? new Decimal(quoteAmount) : null, // обычно равно стоимости SWAP_OUT
        fee: null,           // комиссия уже учтена в SWAP_OUT
        feeCurrency: null,
        timestamp: new Date(timestamp),
        notes: notes ? `${notes} (SWAP_IN)` : 'SWAP_IN',
        manualEdit: true,
      },
    });

    // Обрабатываем обе части (расчёт себестоимости и налоги)
    try {
      await processTransaction(swapOut, user);
      await processTransaction(swapIn, user);
    } catch (err: any) {
      // При ошибке удаляем обе транзакции
      await prisma.transaction.deleteMany({
        where: { id: { in: [swapOut.id, swapIn.id] } },
      });
      return res.status(400).json({ error: err.message });
    }

    return res.json({ swapOut, swapIn });
  }

  // Обычная транзакция (BUY, SELL, ...)
 
  const tx = await prisma.transaction.create({
  data: {
    userId: req.user!.id,
    exchange: 'manual',
    type,
    baseCurrency,
    quoteCurrency,
    baseAmount: (type === 'SELL' || type === 'SWAP_OUT')
      ? new Decimal(Math.abs(Number(baseAmount))).negated()
      : new Decimal(baseAmount),
    quoteAmount,
    fee,
    feeCurrency,
    timestamp: new Date(timestamp),
    notes,
    manualEdit: true,
  },
});

  try {
    await processTransaction(tx, user);
  } catch (err: any) {
    await prisma.transaction.delete({ where: { id: tx.id } });
    return res.status(400).json({ error: err.message });
  }

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

  // Для редактирования свопов нужна отдельная логика, пока упрощённо: удаляем старую и создаём новую
  await prisma.transaction.delete({ where: { id } });

  const { type, baseCurrency, quoteCurrency, baseAmount, quoteAmount, fee, feeCurrency, timestamp, notes } = req.body;
  const newTx = await prisma.transaction.create({
    data: {
      userId: req.user!.id,
      exchange: 'manual',
      type,
      baseCurrency,
      quoteCurrency,
      baseAmount,
      quoteAmount,
      fee,
      feeCurrency,
      timestamp: new Date(timestamp),
      notes,
      manualEdit: true,
    },
  });

  try {
    await processTransaction(newTx, user);
  } catch (err: any) {
    await prisma.transaction.delete({ where: { id: newTx.id } });
    return res.status(400).json({ error: err.message });
  }

  res.json(newTx);
});

export default router;