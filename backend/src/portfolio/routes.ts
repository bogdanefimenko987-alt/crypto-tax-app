import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { Decimal } from 'decimal.js';

const router = Router();
router.use(authenticate);

// Текущий портфель с категориями
router.get('/', async (req: AuthRequest, res) => {
  const lots = await prisma.lot.findMany({
    where: { userId: req.user!.id, remainingAmount: { gt: 0 } },
  });

  // Категории пользователя
  const categories = await prisma.assetCategory.findMany({
    where: { userId: req.user!.id },
  });
  const catMap: Record<string, string> = {};
  categories.forEach(c => { catMap[c.currency] = c.category; });

  const holdings: Record<string, { amount: Decimal; costBasis: Decimal; category?: string }> = {};
  for (const lot of lots) {
    const currency = lot.currency;
    if (!holdings[currency]) {
      holdings[currency] = {
        amount: new Decimal(0),
        costBasis: new Decimal(0),
        category: catMap[currency] || 'Без категории',
      };
    }
    holdings[currency].amount = holdings[currency].amount.plus(lot.remainingAmount.toString());
    holdings[currency].costBasis = holdings[currency].costBasis.plus(
      new Decimal(lot.costPerUnit.toString()).times(lot.remainingAmount.toString())
    );
  }

  res.json({ holdings });
});

// Прибыль/убыток по валютам (PnL)
router.get('/pnl', async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const pnlByCurrency = await prisma.taxEvent.groupBy({
    by: ['currency'],
    where: { userId },
    _sum: {
      proceeds: true,
      costBasis: true,
      gainLoss: true,
    },
  });

  const result = pnlByCurrency.map((item) => ({
    currency: item.currency,
    proceeds: item._sum.proceeds?.toString() || '0',
    costBasis: item._sum.costBasis?.toString() || '0',
    gainLoss: item._sum.gainLoss?.toString() || '0',
  }));

  res.json(result);
});

export default router;