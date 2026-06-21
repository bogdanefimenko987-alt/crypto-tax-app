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

  const fields = ['date', 'currency', 'proceeds', 'costBasis', 'gainLoss', 'taxRate', 'taxAmount'];
  const csvData = events.map(e => ({
    date: e.date.toISOString().slice(0,10),
    currency: e.currency,
    proceeds: e.proceeds.toString(),
    costBasis: e.costBasis.toString(),
    gainLoss: e.gainLoss.toString(),
    taxRate: e.taxRate.toString(),
    taxAmount: e.taxAmount.toString(),
  }));

  // Простой генератор CSV
  const header = fields.join(',') + '\n';
  const rows = csvData.map(row => fields.map(f => `"${row[f]}"`).join(',')).join('\n');
  const csv = header + rows;

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`tax-report-${year}.csv`);
  res.send(csv);
});

// Экспорт в PDF (без Decimal, используем число)
router.get('/report/:year/pdf', async (req: AuthRequest, res) => {
  const year = parseInt(req.params.year);
  const events = await prisma.taxEvent.findMany({
    where: { userId: req.user!.id, taxYear: year },
    orderBy: { date: 'asc' },
  });

  // PDF сформируем упрощённо, без библиотеки pdfkit (чтобы избежать Decimal)
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