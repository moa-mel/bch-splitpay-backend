import { Injectable, BadRequestException } from '@nestjs/common';
import {
  CreateGroupVaultInput,
  PreparedGroupVault,
  prepareGroupVault,
} from './group-vault.types';

@Injectable()
export class GroupVaultService {
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

  toResponse(plan: PreparedGroupVault) {
    return {
      contract: 'GroupVault',
      groupId: plan.groupId,
      status: 'PREPARATION_ONLY',
      targetSatoshis: plan.targetSatoshis.toString(),
      minerFeeSatoshis: plan.minerFeeSatoshis.toString(),
      requiredFundingSatoshis:
        plan.requiredFundingSatoshis.toString(),
      beneficiaryAddress: plan.beneficiaryAddress,
      message:
        'GroupVault settlement preparation completed. On-chain funding and settlement have not been performed.',
    };
  }
}