import { Transaction, User } from '@prisma/client';
import * as fifo from '../costbasis/fifo';
import * as lifo from '../costbasis/lifo';
import * as average from '../costbasis/average';

export async function processTransaction(tx: Transaction, user: User) {
  if (tx.type === 'BUY' || tx.type === 'SWAP_IN') {
    switch (user.costMethod) {
      case 'FIFO': return fifo.createLotFromBuy(tx);
      case 'LIFO': return lifo.createLotFromBuy(tx);
      case 'AVG': return average.createLotFromBuy(tx);
    }
  } else if (tx.type === 'SELL' || tx.type === 'SWAP_OUT') {
    switch (user.costMethod) {
      case 'FIFO': return fifo.processDisposal(tx);
      case 'LIFO': return lifo.processDisposal(tx);
      case 'AVG': return average.processDisposal(tx);
    }
  }
  // Для других типов (TRANSFER, INCOME и т.д.) пока ничего не делаем
}