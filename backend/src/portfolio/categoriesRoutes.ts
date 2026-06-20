import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// Получить все категории пользователя
router.get('/categories', async (req: AuthRequest, res) => {
  const categories = await prisma.assetCategory.findMany({
    where: { userId: req.user!.id },
  });
  res.json(categories);
});

// Назначить категорию валюте (создать или обновить)
router.post('/categories', async (req: AuthRequest, res) => {
  const { currency, category } = req.body;
  const existing = await prisma.assetCategory.findUnique({
    where: {
      userId_currency: {
        userId: req.user!.id,
        currency,
      },
    },
  });

  let result;
  if (existing) {
    result = await prisma.assetCategory.update({
      where: { id: existing.id },
      data: { category },
    });
  } else {
    result = await prisma.assetCategory.create({
      data: {
        userId: req.user!.id,
        currency,
        category,
      },
    });
  }
  res.json(result);
});

export default router;