import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/report/:year', (req: AuthRequest, res) =>
  res.json({ events: [], summary: { totalProceeds: 0, totalCost: 0, totalGain: 0, totalTax: 0 } })
);
router.get('/report/:year/csv', (req: AuthRequest, res) =>
  res.header('Content-Type', 'text/csv').send('date,currency,proceeds,costBasis,gainLoss,taxRate,taxAmount')
);
router.get('/report/:year/pdf', (req: AuthRequest, res) =>
  res.json({ events: [], summary: { totalProceeds: 0, totalCost: 0, totalGain: 0, totalTax: 0 } })
);
router.get('/declaration/:year', (req: AuthRequest, res) =>
  res.json({ year: req.params.year, totalIncome: 0, totalLoss: 0, taxableBase: 0, totalTax: 0, eventsCount: 0 })
);

export default router;