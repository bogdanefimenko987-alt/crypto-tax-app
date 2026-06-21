import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { encrypt } from '../utils/encryption';

const router = Router();
router.use(authenticate);

router.post('/connect', async (req: AuthRequest, res) => {
  const { exchange, apiKey, secret, extra } = req.body;
  const encryptedKey = encrypt(apiKey);
  const encryptedSecret = encrypt(secret);

  await prisma.apiKey.create({
    data: {
      userId: req.user!.id,
      exchange,
      encryptedKey,
      encryptedSecret,
      extra: extra || {},
    },
  });

  // Синхронизация временно отключена (требуется Redis и воркер)
  // await syncQueue.add(
  //   { userId: req.user!.id, exchangeName: exchange },
  //   { repeat: { every: 15 * 60 * 1000 } }
  // );

  res.json({ success: true, message: 'Биржа подключена (синхронизация отключена)' });
});

router.get('/list', async (req: AuthRequest, res) => {
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: req.user!.id },
    select: { id: true, exchange: true, isActive: true, lastSync: true },
  });
  res.json(apiKeys);
});

export default router;