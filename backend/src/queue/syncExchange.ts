import { Worker, Queue } from 'bullmq';
import prisma from '../config/database';
import { decrypt } from '../utils/encryption';
import { Decimal } from 'decimal.js';
import { processTransaction } from '../services/costBasisService';
import ccxt from 'ccxt';

interface SyncJob {
  userId: string;
  exchangeName: string;
}

// Подключение к Redis через переменную окружения
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Очередь с автоматическим созданием подключения (BullMQ сам разберётся)
export const syncQueue = new Queue<SyncJob>('exchange-sync', {
  connection: { url: redisUrl },
});

const worker = new Worker<SyncJob>(
  'exchange-sync',
  async (job) => {
    const { userId, exchangeName } = job.data;
    console.log(`Синхронизация ${exchangeName} для пользователя ${userId}`);

    // 1. Получаем ключи пользователя
    const apiKey = await prisma.apiKey.findFirst({
      where: { userId, exchange: exchangeName, isActive: true },
    });
    if (!apiKey) throw new Error(`API-ключ для ${exchangeName} не найден`);

    const key = decrypt(apiKey.encryptedKey);
    const secret = decrypt(apiKey.encryptedSecret);
    const extra = apiKey.extra as Record<string, string> | undefined;

    // 2. Создаём клиент биржи (используем any, чтобы обойти строгую типизацию ccxt)
    // Проверяем, что биржа поддерживается
    if (!(exchangeName in ccxt)) {
      throw new Error(`Биржа ${exchangeName} не поддерживается`);
    }
    const ExchangeClass = (ccxt as any)[exchangeName];
    const exchange = new ExchangeClass({
      apiKey: key,
      secret: secret,
      ...(extra || {}),
      enableRateLimit: true,
    });
    await exchange.loadMarkets();

    // 3. Загружаем историю сделок
    const since = apiKey.lastSync ? new Date(apiKey.lastSync).getTime() : undefined;
    const trades = await exchange.fetchMyTrades(undefined, since);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Пользователь не найден');

    // 4. Обрабатываем каждую сделку
    for (const trade of trades) {
      const externalId = trade.id;
      const exists = await prisma.transaction.findFirst({
        where: { userId, externalId, exchange: exchangeName },
      });
      if (exists) continue;

      // Определяем, является ли сделка свопом
      const isSwap = trade.info && (trade.info.type === 'swap' || trade.info.isSwap);

      if (isSwap) {
        const fromCurrency = trade.symbol.split('/')[0];
        const toCurrency = trade.info.toCurrency || (trade.info.pair ? trade.info.pair.split(':')[1] : null);
        const fromAmount = new Decimal(trade.amount);
        const toAmount = trade.info.toAmount ? new Decimal(trade.info.toAmount) : new Decimal(trade.cost);
        const fee = trade.fee?.cost ? new Decimal(trade.fee.cost) : new Decimal(0);
        const feeCurrency = trade.fee?.currency || fromCurrency;

        // SWAP_OUT
        const swapOut = await prisma.transaction.create({
          data: {
            userId,
            exchange: exchangeName,
            externalId: `${externalId}_out`,
            type: 'SWAP_OUT',
            baseCurrency: fromCurrency,
            quoteCurrency: trade.symbol.split('/')[1],
            baseAmount: fromAmount.negated(),
            quoteAmount: new Decimal(trade.cost),
            fee,
            feeCurrency,
            timestamp: new Date(trade.timestamp),
          },
        });
        await processTransaction(swapOut, user);

        // SWAP_IN
        const swapIn = await prisma.transaction.create({
          data: {
            userId,
            exchange: exchangeName,
            externalId: `${externalId}_in`,
            type: 'SWAP_IN',
            baseCurrency: toCurrency || trade.symbol.split('/')[1],
            quoteCurrency: trade.symbol.split('/')[1],
            baseAmount: toAmount,
            quoteAmount: new Decimal(trade.cost),
            fee: null,
            feeCurrency: null,
            timestamp: new Date(trade.timestamp),
          },
        });
        await processTransaction(swapIn, user);
      } else {
        const type = trade.side === 'buy' ? 'BUY' : 'SELL';
        const baseCurrency = trade.symbol.split('/')[0];
        const quoteCurrency = trade.symbol.split('/')[1];
        const baseAmount = new Decimal(trade.amount);
        const quoteAmount = new Decimal(trade.cost);

        const tx = await prisma.transaction.create({
          data: {
            userId,
            exchange: exchangeName,
            externalId,
            type,
            baseCurrency,
            quoteCurrency,
            baseAmount: type === 'BUY' ? baseAmount : baseAmount.negated(),
            quoteAmount,
            fee: trade.fee?.cost ? new Decimal(trade.fee.cost) : null,
            feeCurrency: trade.fee?.currency || null,
            timestamp: new Date(trade.timestamp),
          },
        });
        await processTransaction(tx, user);
      }
    }

    // Обновляем время последней синхронизации
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastSync: new Date() },
    });

    console.log(`Синхронизация ${exchangeName} завершена`);
  },
  { connection: { url: redisUrl } }
);