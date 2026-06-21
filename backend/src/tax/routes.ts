import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

const router = Router();
router.use(authenticate);

// Налоговый отчёт за год (JSON)
router.get('/report/:year', async (req: AuthRequest, res) => {
  const year = parseInt(req.params.year);
  const events = await prisma.taxEvent.findMany({
    where: {
      userId: req.user!.id,
      taxYear: year,
    },
    orderBy: { date: 'asc' },
  });

  const totalProceeds = events.reduce((s, e) => s + e.proceeds, 0);
  const totalCost = events.reduce((s, e) => s + e.costBasis, 0);
  const totalGain = totalProceeds - totalCost;
  const totalTax = events.reduce((s, e) => s + e.taxAmount, 0);

  res.json({ events, summary: { totalProceeds, totalCost, totalGain, totalTax } });
});

// Экспорт в CSV
router.get('/report/:year/csv', async (req: AuthRequest, res) => {
  const year = parseInt(req.params.year);
  const events = await prisma.taxEvent.findMany({
    where: { userId: req.user!.id, taxYear: year },
    orderBy: { date: 'asc' },
  });

  const header = 'date,currency,proceeds,costBasis,gainLoss,taxRate,taxAmount';
  const rows = events.map(e => {
    return [
      e.date.toISOString().slice(0,10),
      e.currency,
      e.proceeds.toString(),
      e.costBasis.toString(),
      e.gainLoss.toString(),
      e.taxRate.toString(),
      e.taxAmount.toString(),
    ].join(',');
  });
  const csv = header + '\n' + rows.join('\n');

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`tax-report-${year}.csv`);
  res.send(csv);
});

// Экспорт в PDF (упрощённый)
router.get('/report/:year/pdf', async (req: AuthRequest, res) => {
  const year = parseInt(req.params.year);
  const events = await prisma.taxEvent.findMany({
    where: { userId: req.user!.id, taxYear: year },
    orderBy: { date: 'asc' },
  });

  const summary = events.reduce((acc, e) => {
    acc.totalProceeds += e.proceeds;
    acc.totalCost += e.costBasis;
    acc.totalGain += e.gainLoss;
    acc.totalTax += e.taxAmount;
    return acc;
  }, { totalProceeds: 0, totalCost: 0, totalGain: 0, totalTax: 0 });

  res.json({ events, summary });
});

// Декларация
router.get('/declaration/:year', async (req: AuthRequest, res) => {
  const year = parseInt(req.params.year);
  const events = await prisma.taxEvent.findMany({
    where: { userId: req.user!.id, taxYear: year },
  });

  const totalIncome = events
    .filter(e => e.gainLoss > 0)
    .reduce((s, e) => s + e.gainLoss, 0);
  const totalLoss = events
    .filter(e => e.gainLoss < 0)
    .reduce((s, e) => s + e.gainLoss, 0);
  const totalTax = events.reduce((s, e) => s + e.taxAmount, 0);

  res.json({
    year,
    totalIncome,
    totalLoss: Math.abs(totalLoss),
    taxableBase: totalIncome - Math.abs(totalLoss),
    totalTax,
    currency: 'RUB',
    eventsCount: events.length,
  });
});

export default router;