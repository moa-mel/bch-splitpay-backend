
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';

import { NetworkProvider } from './network.provider';

interface ElectrumTransaction {
  txid: string;
  vout: Array<{
    value: number;
    n?: number;
    scriptPubKey: {
      address?: string;
      addresses?: string[];
      hex?: string;
      type?: string;
    };
  }>;
}

@Injectable()
export class TransactionVerifierService {
  constructor(
    private readonly networkProvider: NetworkProvider,
  ) {}

  async verify(transactionId: string) {
    if (!/^[a-fA-F0-9]{64}$/.test(transactionId)) {
      throw new BadRequestException(
        'A valid 64-character transaction ID is required.',
      );
    }

    let transaction: ElectrumTransaction;

    try {
      transaction =
        await this.networkProvider.call<ElectrumTransaction>(
          'getrawtransaction',
          [transactionId, true],
        );
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      if (
        error instanceof HttpException &&
        error.getStatus() === 503
      ) {
        throw error;
      }

      throw new NotFoundException(
        'Transaction was not found on BCH Chipnet.',
      );
    }

    if (!transaction || !Array.isArray(transaction.vout)) {
      throw new NotFoundException(
        'Electrum did not return transaction outputs.',
      );
    }

    let transactionHeight: number | null;
    let tipHeight: number;

    try {
      transactionHeight =
        await this.networkProvider.call<number | null>(
          'gettransactionheight',
          [transactionId],
        );

      tipHeight =
        await this.networkProvider.call<number>(
          'gettipheight',
        );
    } catch {
      throw new ServiceUnavailableException(
        'Unable to retrieve BCH confirmation data.',
      );
    }

    if (transactionHeight === null) {
      throw new NotFoundException(
        'Transaction is not known to the BCH network.',
      );
    }

    const confirmations =
      transactionHeight > 0
        ? Math.max(
            0,
            tipHeight - transactionHeight + 1,
          )
        : 0;

    return {
      transactionId: transaction.txid || transactionId,
      network: this.networkProvider.getNetwork(),
      found: true,
      confirmed: confirmations > 0,
      confirmations,
      blockHeight:
        transactionHeight > 0
          ? transactionHeight
          : null,
      status:
        confirmations > 0
          ? 'CONFIRMED'
          : 'UNCONFIRMED',
    };
  }

  async verifyPaymentOutput(
    transactionId: string,
    expectedAddress: string,
    expectedSatoshis: bigint,
  ) {
    if (expectedSatoshis <= 0n) {
      throw new BadRequestException(
        'Expected payment amount must be greater than zero.',
      );
    }

    const transaction = await this.verify(transactionId);

    const raw =
      await this.networkProvider.call<ElectrumTransaction>(
        'getrawtransaction',
        [transactionId, true],
      );

    const paidSatoshis = raw.vout.reduce(
      (sum, output) => {
        const addresses = [
          output.scriptPubKey?.address,
          ...(output.scriptPubKey?.addresses ?? []),
        ].filter(
          (address): address is string =>
            Boolean(address),
        );

        if (!addresses.includes(expectedAddress)) {
          return sum;
        }

        return (
          sum +
          BigInt(
            Math.round(output.value * 100_000_000),
          )
        );
      },
      0n,
    );

    return {
      ...transaction,
      expectedSatoshis: expectedSatoshis.toString(),
      paidSatoshis: paidSatoshis.toString(),
      paymentMatches:
        paidSatoshis === expectedSatoshis,
    };
  }
}
