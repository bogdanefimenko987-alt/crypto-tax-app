import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { transactions } from '../store';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res) => {
  const userTxs = transactions.filter((tx: any) => tx.userId === req.user!.id);
  res.json(userTxs);
});

router.post('/manual', (req: AuthRequest, res) => {
  const tx = {
    id: uuidv4(),
    userId: req.user!.id,
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  transactions.push(tx);
  res.json(tx);
});

export default router;