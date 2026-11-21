
import { Injectable, BadRequestException } from '@nestjs/common';

import {
  CreateSplitRouterInput,
  PreparedSplitRouter,
  prepareSplitRouter,
} from './split-router.types';

import { CashScriptService } from '../cashscript.service';

interface SplitExecutionInput extends Record<string, unknown> {
  recipients: Array<{
    address: string;
    amountSatoshis: string;
  }>;
}

@Injectable()
export class SplitRouterService {
  constructor(
    private readonly cashScript: CashScriptService,
  ) {}

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

  private toContractInput(
    plan: PreparedSplitRouter,
  ): SplitExecutionInput {
    return {
      recipients: plan.recipients.map((recipient) => ({
        address: recipient.address,
        amountSatoshis: recipient.amountSatoshis.toString(),
      })),
    };
  }

  async getContractAddress(plan: PreparedSplitRouter) {
    return this.cashScript.execute<{
      network: string;
      contractAddress: string;
      requiredFundingSatoshis: string;
    }>('prepare-split', this.toContractInput(plan));
  }

  async execute(plan: PreparedSplitRouter) {
    return this.cashScript.execute<{
      network: string;
      contractAddress: string;
      transactionId: string;
      status: string;
    }>('execute-split', this.toContractInput(plan));
  }
}
