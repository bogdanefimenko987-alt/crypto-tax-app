import { PrismaClient, Transaction } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { getProgressiveTaxRate } from '../tax/taxUtils'; // см. следующий раздел

const prisma = new PrismaClient();

export async function createLotFromBuy(tx: Transaction) {
  let lot = await prisma.lot.findFirst({
    where: { userId: tx.userId, currency: tx.baseCurrency, closed: false },
  });
  if (!lot) {
    lot = await prisma.lot.create({
      data: {
        userId: tx.userId,
        currency: tx.baseCurrency,
        openTxId: tx.id,
        totalAmount: new Decimal(0),
        remainingAmount: new Decimal(0),
        costPerUnit: new Decimal(0),
        acquiredAt: tx.timestamp,
      },
    });
  }

  const newAmount = new Decimal(tx.baseAmount.toString());
  const newCost = new Decimal(tx.quoteAmount!.toString());
  const oldTotalCost = new Decimal(lot.costPerUnit.toString()).times(lot.remainingAmount.toString());
  const totalAmount = new Decimal(lot.remainingAmount.toString()).plus(newAmount);
  const newAvgCost = oldTotalCost.plus(newCost).div(totalAmount);

  await prisma.lot.update({
    where: { id: lot.id },
    data: {
      remainingAmount: totalAmount,
      totalAmount: totalAmount,
      costPerUnit: newAvgCost,
    },
  });
}

export async function processDisposal(tx: Transaction) {
  const lot = await prisma.lot.findFirst({
    where: { userId: tx.userId, currency: tx.baseCurrency, closed: false },
  });
  if (!lot || new Decimal(lot.remainingAmount.toString()).lessThan(new Decimal(tx.baseAmount.toString()).abs())) {
    throw new Error('Недостаточно средств');
  }

  const amount = new Decimal(tx.baseAmount.toString()).abs();
  const costPerUnit = new Decimal(lot.costPerUnit.toString());
  const totalCost = costPerUnit.times(amount);
  const proceeds = new Decimal(tx.quoteAmount!.toString());
  const gain = proceeds.minus(totalCost);

  const newRemaining = new Decimal(lot.remainingAmount.toString()).minus(amount);
  await prisma.lot.update({
    where: { id: lot.id },
    data: { remainingAmount: newRemaining, closed: newRemaining.eq(0) },
  });

  const taxYear = tx.timestamp.getFullYear();
  const taxRate = await getProgressiveTaxRate(tx.userId, taxYear, gain);
  await prisma.taxEvent.create({
    data: {
      userId: tx.userId,
      taxYear,
      eventType: 'CAPITAL_GAIN',
      date: tx.timestamp,
      currency: tx.baseCurrency,
      proceeds,
      costBasis: totalCost,
      gainLoss: gain,
      taxRate,
      taxAmount: gain.times(taxRate),
    },
  });
  return { gain, totalCost, proceeds };
}
