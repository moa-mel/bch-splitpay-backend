import { Injectable, NotFoundException } from '@nestjs/common';
import { NetworkProvider } from './network.provider';

interface RawTransactionResult {
  txid: string;
  confirmations?: number;
  blockhash?: string;
  time?: number;
  hex?: string;
}

@Injectable()
export class TransactionVerifierService {
  constructor(
    private readonly networkProvider: NetworkProvider,
  ) {}

  async verify(transactionId: string) {
    const txidPattern = /^[a-fA-F0-9]{64}$/;

    if (!txidPattern.test(transactionId)) {
      throw new NotFoundException('Invalid transaction ID.');
    }

    let transaction: RawTransactionResult;

    try {
      transaction =
        await this.networkProvider.call<RawTransactionResult>(
          'getrawtransaction',
          [transactionId, true],
        );
    } catch {
      throw new NotFoundException(
        'Transaction was not found by the BCH node.',
      );
    }

    const confirmations = transaction.confirmations ?? 0;

    return {
      transactionId: transaction.txid,
      network: this.networkProvider.getNetwork(),
      found: true,
      confirmed: confirmations > 0,
      confirmations,
      blockHash: transaction.blockhash ?? null,
      timestamp: transaction.time ?? null,
      status:
        confirmations > 0 ? 'CONFIRMED' : 'UNCONFIRMED',
    };
  }
}