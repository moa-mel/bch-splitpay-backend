import { Module } from '@nestjs/common';
import { SplitsController } from './splits.controller';
import { SplitsService } from './splits.service';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [ContractsModule],
  controllers: [SplitsController],
  providers: [SplitsService],
})
export class SplitsModule {}
