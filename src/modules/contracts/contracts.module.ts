import { Module } from '@nestjs/common';
import { CashScriptService } from './cashscript.service';
import { SplitRouterService } from './split-router/split-router.service';
import { GroupVaultService } from './group-vault/group-vault.service';

@Module({
  providers: [
    CashScriptService,
    SplitRouterService,
    GroupVaultService,
  ],
  exports: [
    CashScriptService,
    SplitRouterService,
    GroupVaultService,
  ],
})
export class ContractsModule {}