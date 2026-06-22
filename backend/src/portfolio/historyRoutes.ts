import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/history', (_req: AuthRequest, res: Response) => res.json([]));

export default router;