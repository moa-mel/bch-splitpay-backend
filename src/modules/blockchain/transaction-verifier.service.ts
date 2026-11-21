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

  async verifyPaymentOutput(
  transactionId: string,
  expectedAddress: string,
  expectedSatoshis: bigint,
) {
  const transaction = await this.verify(transactionId);

  const raw = await this.networkProvider.call<{
    vout: Array<{
      value: number;
      scriptPubKey: {
        address?: string;
        addresses?: string[];
      };
    }>;
  }>('getrawtransaction', [transactionId, true]);

  const paidSatoshis = raw.vout.reduce((sum, output) => {
    const addresses = [
      output.scriptPubKey.address,
      ...(output.scriptPubKey.addresses ?? []),
    ].filter(Boolean);

    if (!addresses.includes(expectedAddress)) {
      return sum;
    }

    return sum + BigInt(
      Math.round(output.value * 100_000_000),
    );
  }, 0n);

  return {
    ...transaction,
    expectedSatoshis: expectedSatoshis.toString(),
    paidSatoshis: paidSatoshis.toString(),
    paymentMatches: paidSatoshis === expectedSatoshis,
  };
}
}