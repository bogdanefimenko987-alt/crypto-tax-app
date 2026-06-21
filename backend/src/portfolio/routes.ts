import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

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

  const holdings: Record<string, { amount: number; costBasis: number; category?: string }> = {};
  for (const lot of lots) {
    const currency = lot.currency;
    if (!holdings[currency]) {
      holdings[currency] = {
        amount: 0,
        costBasis: 0,
        category: catMap[currency] || 'Без категории',
      };
    }
    holdings[currency].amount += lot.remainingAmount;           // теперь это Float
    holdings[currency].costBasis += lot.costPerUnit * lot.remainingAmount; // число
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
    proceeds: item._sum.proceeds || 0,
    costBasis: item._sum.costBasis || 0,
    gainLoss: item._sum.gainLoss || 0,
  }));

  res.json(result);
});

export default router;