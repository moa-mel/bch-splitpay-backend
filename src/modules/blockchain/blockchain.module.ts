import { Module } from '@nestjs/common';
import { NetworkProvider } from './network.provider';
import { TransactionService } from './transaction.service';
import { TransactionVerifierService } from './transaction-verifier.service';
import { ConfirmationService } from './confirmation.service';

@Module({
  providers: [
    NetworkProvider,
    TransactionService,
    TransactionVerifierService,
    ConfirmationService,
  ],
  exports: [
    NetworkProvider,
    TransactionService,
    TransactionVerifierService,
    ConfirmationService,
  ],
})
export class BlockchainModule {}