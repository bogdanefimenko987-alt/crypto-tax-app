import { PrismaClient, Transaction, Lot } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

async function getCostInBaseCurrency(tx: Transaction): Promise<Decimal> {
  if (tx.quoteAmount) {
    return new Decimal(tx.quoteAmount.toString());
  }
  throw new Error('Невозможно определить стоимость');
}

export async function createLotFromBuy(tx: Transaction) {
  const costTotal = await getCostInBaseCurrency(tx);
  const costPerUnit = costTotal.div(new Decimal(tx.baseAmount.toString()));
  await prisma.lot.create({
    data: {
      userId: tx.userId,
      currency: tx.baseCurrency,
      openTxId: tx.id,
      totalAmount: tx.baseAmount,
      remainingAmount: tx.baseAmount,
      costPerUnit: costPerUnit,
      acquiredAt: tx.timestamp,
    },
  });
}

export async function processDisposal(tx: Transaction) {
  const currency = tx.baseCurrency;
  const amountToDispose = new Decimal(tx.baseAmount.toString()).abs();

  const lots = await prisma.lot.findMany({
    where: {
      userId: tx.userId,
      currency,
      remainingAmount: { gt: 0 },
      closed: false,
    },
    orderBy: { acquiredAt: 'asc' },
  });

  let remaining = amountToDispose;
  const usedLots: { lot: Lot; amount: Decimal }[] = [];

  for (const lot of lots) {
    if (remaining.lte(0)) break;
    const available = new Decimal(lot.remainingAmount.toString());
    const useAmount = Decimal.min(available, remaining);
    usedLots.push({ lot, amount: useAmount });
    remaining = remaining.minus(useAmount);
  }

  if (remaining.gt(0)) {
    throw new Error(`Недостаточно лотов для продажи ${currency}. Не хватает ${remaining}`);
  }

  await prisma.$transaction(async (txPrisma) => {
    for (const { lot, amount } of usedLots) {
      const newRemaining = new Decimal(lot.remainingAmount.toString()).minus(amount);
      await txPrisma.lot.update({
        where: { id: lot.id },
        data: {
          remainingAmount: newRemaining,
          closed: newRemaining.eq(0),
        },
      });
    }
  });

  const totalCost = usedLots.reduce(
    (sum, { lot, amount }) => sum.plus(new Decimal(lot.costPerUnit.toString()).times(amount)),
    new Decimal(0)
  );

  const proceeds = new Decimal(tx.quoteAmount?.toString() || '0');
  const gain = proceeds.minus(totalCost);
  const taxYear = tx.timestamp.getFullYear();
  const taxRate = new Decimal(0.13);

  await prisma.taxEvent.create({
    data: {
      userId: tx.userId,
      taxYear,
      eventType: 'CAPITAL_GAIN',
      date: tx.timestamp,
      currency,
      proceeds,
      costBasis: totalCost,
      gainLoss: gain,
      taxRate,
      taxAmount: gain.times(taxRate),
    },
  });

  return { gain, totalCost, proceeds };
}
