import { Module } from '@nestjs/common';
import { SplitRouterService } from './split-router/split-router.service';
import { GroupVaultService } from './group-vault/group-vault.service';

@Module({
  providers: [SplitRouterService, GroupVaultService],
  exports: [SplitRouterService, GroupVaultService],
})
export class ContractsModule {}