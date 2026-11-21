import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [ContractsModule, BlockchainModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
