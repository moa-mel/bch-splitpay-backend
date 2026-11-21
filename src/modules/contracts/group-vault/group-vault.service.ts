import { Injectable, BadRequestException } from '@nestjs/common';

import {
  CreateGroupVaultInput,
  PreparedGroupVault,
  prepareGroupVault,
} from './group-vault.types';

import { CashScriptService } from '../cashscript.service';

@Injectable()
export class GroupVaultService {
  constructor(
    private readonly cashScript: CashScriptService,
  ) {}

  prepare(input: CreateGroupVaultInput): PreparedGroupVault {
    try {
      return prepareGroupVault(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Unable to prepare GroupVault.',
      );
    }
  }

  async getContractAddress(plan: PreparedGroupVault) {
    return this.cashScript.execute<{
      network: string;
      contractAddress: string;
    }>('prepare-group', {
      beneficiaryAddress: plan.beneficiaryAddress,
      targetSatoshis: plan.targetSatoshis.toString(),
    });
  }

  async settle(plan: PreparedGroupVault) {
    return this.cashScript.execute<{
      transactionId: string;
      status: string;
    }>('execute-group', {
      beneficiaryAddress: plan.beneficiaryAddress,
      targetSatoshis: plan.targetSatoshis.toString(),
    });
  }
}