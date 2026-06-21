import prisma from '../config/database';

export async function getProgressiveTaxRate(userId: string, year: number, currentGain: number): Promise<number> {
  const aggregate = await prisma.taxEvent.aggregate({
    where: { userId, taxYear: year },
    _sum: { gainLoss: true },
  });
  const previousGain = aggregate._sum.gainLoss || 0;
  const totalGain = previousGain + currentGain;
  const threshold = 5_000_000;
  return totalGain > threshold ? 0.15 : 0.13;
}