
import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { NetworkProvider } from './network.provider';

@Injectable()
export class TransactionService {
  constructor(
    private readonly networkProvider: NetworkProvider,
  ) {}

  async broadcast(rawTransactionHex: string) {
    if (
      !rawTransactionHex ||
      !/^(?:[0-9a-fA-F]{2})+$/.test(rawTransactionHex)
    ) {
      throw new BadRequestException(
        'A valid raw transaction hex string is required.',
      );
    }

    const transactionId =
      await this.networkProvider.call<string>(
        'sendrawtransaction',
        [rawTransactionHex],
      );

    return {
      transactionId,
      network: this.networkProvider.getNetwork(),
      status: 'BROADCAST',
    };
  }
}
