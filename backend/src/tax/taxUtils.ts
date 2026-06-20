import prisma from '../config/database';
import { Decimal } from 'decimal.js';

export async function getProgressiveTaxRate(userId: string, year: number, currentGain: Decimal): Promise<Decimal> {
  const aggregate = await prisma.taxEvent.aggregate({
    where: { userId, taxYear: year },
    _sum: { gainLoss: true },
  });
  const previousGain = new Decimal(aggregate._sum.gainLoss || 0);
  const totalGain = previousGain.plus(currentGain);
  const threshold = new Decimal(5_000_000);
  return totalGain.greaterThan(threshold) ? new Decimal(0.15) : new Decimal(0.13);
}
