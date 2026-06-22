import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (_req: AuthRequest, res: Response) => res.json({ holdings: {} }));
router.get('/pnl', (_req: AuthRequest, res: Response) => res.json([]));

export default router;