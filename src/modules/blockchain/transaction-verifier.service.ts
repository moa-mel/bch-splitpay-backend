
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';

import {
  cashAddressToLockingBytecode,
  decodeTransaction,
  hexToBin,
} from '@bitauth/libauth';

import { NetworkProvider } from './network.provider';

interface InspectedTransaction {
  transactionId: string;
  confirmations: number;
  blockHeight: number | null;
  status: 'CONFIRMED' | 'UNCONFIRMED';
  confirmed: boolean;
}

function equalBytes(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

@Injectable()
export class TransactionVerifierService {
  constructor(
    private readonly networkProvider: NetworkProvider,
  ) {}

  private validateTransactionId(transactionId: string) {
    if (!/^[a-fA-F0-9]{64}$/.test(transactionId)) {
      throw new BadRequestException(
        'A valid 64-character transaction ID is required.',
      );
    }
  }

  private async inspectTransaction(
    transactionId: string,
  ): Promise<{
    transaction: InspectedTransaction;
    outputs: Array<{
      lockingBytecode: Uint8Array;
      valueSatoshis: bigint;
    }>;
  }> {
    this.validateTransactionId(transactionId);

    let rawTransaction: string;

    try {
      // Electrum returns serialized transaction hex when verbose is false.
      rawTransaction =
        await this.networkProvider.call<string>(
          'getrawtransaction',
          [transactionId, false],
        );
    } catch (error) {
      if (error instanceof HttpException) {
        const message = error.message.toLowerCase();

        if (
          message.includes('not found') ||
          message.includes('no such') ||
          message.includes('unknown transaction')
        ) {
          throw new NotFoundException(
            'Transaction was not found on BCH Chipnet.',
          );
        }

        throw error;
      }

      throw new ServiceUnavailableException(
        'Unable to retrieve the transaction from BCH Chipnet.',
      );
    }

    if (
      typeof rawTransaction !== 'string' ||
      !/^(?:[a-fA-F0-9]{2})+$/.test(rawTransaction)
    ) {
      throw new ServiceUnavailableException(
        'Electrum did not return valid raw transaction hex. Check that the configured server supports blockchain.transaction.get.',
      );
    }

    const decoded = decodeTransaction(
      hexToBin(rawTransaction),
    );

    if (typeof decoded === 'string') {
      throw new InternalServerErrorException(
        `Unable to decode the BCH transaction: ${decoded}`,
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

    if (
      transactionHeight === null ||
      transactionHeight < 0
    ) {
      throw new NotFoundException(
        'Transaction is not known to the BCH network.',
      );
    }

    // Electrum reports height 0 for a transaction in the mempool.
    const confirmations =
      transactionHeight > 0
        ? Math.max(0, tipHeight - transactionHeight + 1)
        : 0;

    const confirmed = confirmations > 0;

    return {
      transaction: {
        transactionId,
        confirmations,
        blockHeight:
          transactionHeight > 0
            ? transactionHeight
            : null,
        status: confirmed ? 'CONFIRMED' : 'UNCONFIRMED',
        confirmed,
      },
      outputs: decoded.outputs.map((output) => ({
        lockingBytecode: output.lockingBytecode,
        valueSatoshis: output.valueSatoshis,
      })),
    };
  }

  async verify(transactionId: string) {
    const result = await this.inspectTransaction(
      transactionId,
    );

    return {
      ...result.transaction,
      network: this.networkProvider.getNetwork(),
      found: true,
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

    if (!expectedAddress) {
      throw new BadRequestException(
        'A GroupVault address is required for payment verification.',
      );
    }

    const expectedOutput =
      cashAddressToLockingBytecode(expectedAddress);

    if (typeof expectedOutput === 'string') {
      throw new BadRequestException(
        `Invalid GroupVault CashAddress: ${expectedOutput}`,
      );
    }

    const inspected = await this.inspectTransaction(
      transactionId,
    );

    const paidSatoshis = inspected.outputs.reduce(
      (total, output) => {
        if (
          equalBytes(
            output.lockingBytecode,
            expectedOutput.bytecode,
          )
        ) {
          return total + output.valueSatoshis;
        }

        return total;
      },
      0n,
    );

    return {
      ...inspected.transaction,
      network: this.networkProvider.getNetwork(),
      found: true,
      expectedSatoshis: expectedSatoshis.toString(),
      paidSatoshis: paidSatoshis.toString(),
      paymentMatches:
        paidSatoshis === expectedSatoshis,
    };
  }
}
