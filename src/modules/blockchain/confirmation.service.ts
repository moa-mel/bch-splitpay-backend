import { Injectable } from '@nestjs/common';
import { TransactionVerifierService } from './transaction-verifier.service';

@Injectable()
export class ConfirmationService {
  constructor(
    private readonly verifier: TransactionVerifierService,
  ) {}

  async getConfirmationStatus(transactionId: string) {
    const result = await this.verifier.verify(transactionId);

    return {
      transactionId: result.transactionId,
      confirmed: result.confirmed,
      confirmations: result.confirmations,
      status: result.status,
      network: result.network,
    };
  }

  async isConfirmed(
    transactionId: string,
    minimumConfirmations = 1,
  ): Promise<boolean> {
    if (
      !Number.isInteger(minimumConfirmations) ||
      minimumConfirmations < 1
    ) {
      throw new Error(
        'Minimum confirmations must be a positive integer.',
      );
    }

    const result = await this.verifier.verify(transactionId);

    return result.confirmations >= minimumConfirmations;
  }
}