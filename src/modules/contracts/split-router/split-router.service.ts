import { Injectable, BadRequestException } from '@nestjs/common';
import {
  CreateSplitRouterInput,
  PreparedSplitRouter,
  prepareSplitRouter,
} from './split-router.types';

@Injectable()
export class SplitRouterService {
  prepare(input: CreateSplitRouterInput): PreparedSplitRouter {
    try {
      return prepareSplitRouter(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Unable to prepare SplitRouter.',
      );
    }
  }

  toResponse(plan: PreparedSplitRouter) {
    return {
      contract: 'SplitRouter',
      status: 'PREPARATION_ONLY',
      recipients: plan.recipients.map((recipient) => ({
        name: recipient.name,
        address: recipient.address,
        amountSatoshis: recipient.amountSatoshis.toString(),
      })),
      totalSatoshis: plan.totalSatoshis.toString(),
      minerFeeSatoshis: plan.minerFeeSatoshis.toString(),
      requiredFundingSatoshis:
        plan.requiredFundingSatoshis.toString(),
      message:
        'SplitRouter payout preparation completed. Contract execution has not been performed.',
    };
  }
}