import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { Decimal } from 'decimal.js';

const router = Router();
router.use(authenticate);

// История балансов по дням (на основе всех транзакций)
router.get('/history', async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  // Получаем все транзакции пользователя, отсортированные по дате (старые -> новые)
  const txs = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { timestamp: 'asc' },
  });

  // Агрегируем балансы в динамике
  const balances: Record<string, Decimal> = {};
  const history: any[] = [];   // ← исправлено

  for (const tx of txs) {
    const dateKey = tx.timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
    // Если первый день или сменился день — добавляем новую точку
    if (history.length === 0 || history[history.length - 1].date !== dateKey) {
      history.push({ date: dateKey });
    }
    const cur = tx.baseCurrency;
    const amount = new Decimal(tx.baseAmount.toString());
    balances[cur] = (balances[cur] || new Decimal(0)).plus(amount);

    // Записываем текущие балансы в последнюю точку
    const last = history[history.length - 1];
    for (const [curr, bal] of Object.entries(balances)) {
      last[curr] = Number(bal.toFixed(8)); // ограничим знаки для графика
    }
  }

  res.json(history);
});

export default router;