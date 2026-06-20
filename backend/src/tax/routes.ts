import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { Decimal } from 'decimal.js';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

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

  const totalProceeds = events.reduce((s, e) => s.plus(e.proceeds.toString()), new Decimal(0));
  const totalCost = events.reduce((s, e) => s.plus(e.costBasis.toString()), new Decimal(0));
  const totalGain = totalProceeds.minus(totalCost);
  const totalTax = events.reduce((s, e) => s.plus(e.taxAmount.toString()), new Decimal(0));

  res.json({ events, summary: { totalProceeds, totalCost, totalGain, totalTax } });
});

// Экспорт в CSV
router.get('/report/:year/csv', async (req: AuthRequest, res: Response) => {
  const year = parseInt(req.params.year);
  const events = await prisma.taxEvent.findMany({
    where: { userId: req.user!.id, taxYear: year },
    orderBy: { date: 'asc' },
  });

  const fields = ['date', 'currency', 'proceeds', 'costBasis', 'gainLoss', 'taxRate', 'taxAmount'];
  const parser = new Parser({ fields });
  const csv = parser.parse(events.map(e => ({
    date: e.date.toISOString().slice(0,10),
    currency: e.currency,
    proceeds: e.proceeds.toString(),
    costBasis: e.costBasis.toString(),
    gainLoss: e.gainLoss.toString(),
    taxRate: e.taxRate.toString(),
    taxAmount: e.taxAmount.toString(),
  })));

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`tax-report-${year}.csv`);
  res.send(csv);
});

// Экспорт в PDF
router.get('/report/:year/pdf', async (req: AuthRequest, res: Response) => {
  const year = parseInt(req.params.year);
  const events = await prisma.taxEvent.findMany({
    where: { userId: req.user!.id, taxYear: year },
    orderBy: { date: 'asc' },
  });

  const doc = new PDFDocument({ margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="tax-report-${year}.pdf"`);
  doc.pipe(res);

  // Заголовок
  doc.fontSize(18).text(`Налоговый отчёт по операциям с криптовалютами за ${year} год`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).text(`Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`);
  doc.moveDown();

  // Таблица
  const tableTop = doc.y;
  const colWidths = [70, 60, 70, 70, 70, 50, 60];
  const headers = ['Дата', 'Валюта', 'Доход (руб)', 'Расход (руб)', 'Прибыль (руб)', 'Ставка', 'Налог (руб)'];
  let currentTop = tableTop;

  // Заголовки таблицы
  doc.font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(h, 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), currentTop, { width: colWidths[i], align: 'right' });
  });
  currentTop += 20;

  // Строки
  doc.font('Helvetica');
  events.forEach(e => {
    const row = [
      e.date.toISOString().slice(0,10),
      e.currency,
      Number(e.proceeds).toFixed(2),
      Number(e.costBasis).toFixed(2),
      Number(e.gainLoss).toFixed(2),
      `${e.taxRate}%`,
      Number(e.taxAmount).toFixed(2)
    ];
    row.forEach((cell, i) => {
      doc.text(cell, 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), currentTop, { width: colWidths[i], align: 'right' });
    });
    currentTop += 15;
  });

  // Итоги
  doc.moveDown();
  const totalGain = events.reduce((sum, e) => sum.plus(e.gainLoss.toString()), new Decimal(0));
  const totalTax = events.reduce((sum, e) => sum.plus(e.taxAmount.toString()), new Decimal(0));
  doc.font('Helvetica-Bold');
  doc.text(`Общая прибыль: ${Number(totalGain).toFixed(2)} руб.`);
  doc.text(`Общая сумма налога к уплате: ${Number(totalTax).toFixed(2)} руб.`);
  doc.end();
});

// Декларация (JSON с агрегацией)
router.get('/declaration/:year', async (req: AuthRequest, res) => {
  const year = parseInt(req.params.year);
  const events = await prisma.taxEvent.findMany({
    where: { userId: req.user!.id, taxYear: year },
  });

  const totalIncome = events
    .filter(e => e.gainLoss.toString() > '0')
    .reduce((s, e) => s.plus(e.gainLoss.toString()), new Decimal(0));
  const totalLoss = events
    .filter(e => e.gainLoss.toString() < '0')
    .reduce((s, e) => s.plus(e.gainLoss.toString()), new Decimal(0));
  const totalTax = events.reduce((s, e) => s.plus(e.taxAmount.toString()), new Decimal(0));

  res.json({
    year,
    totalIncome: totalIncome.toFixed(2),
    totalLoss: totalLoss.abs().toFixed(2),
    taxableBase: totalIncome.minus(totalLoss.abs()).toFixed(2),
    totalTax: totalTax.toFixed(2),
    currency: 'RUB',
    eventsCount: events.length,
  });
});

export default router;