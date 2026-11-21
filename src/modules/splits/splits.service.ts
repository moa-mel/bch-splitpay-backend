import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PreviewSplitDto } from './dto/preview-split.dto';
import { SplitRouterService } from '../contracts/split-router/split-router.service';

function toSatoshis(amount: number): bigint {
  const value = amount.toFixed(8);
  const [whole, fraction] = value.split('.');

  return (
    BigInt(whole) * 100_000_000n +
    BigInt(fraction)
  );
}

function toBch(satoshis: bigint): string {
  const whole = satoshis / 100_000_000n;
  const fraction = (satoshis % 100_000_000n)
    .toString()
    .padStart(8, '0');

  return `${whole}.${fraction}`;
}

@Injectable()
export class SplitsService {
  constructor(
    private readonly splitRouter: SplitRouterService,
  ) {}

  async preview(dto: PreviewSplitDto) {
    if (dto.recipients.length !== 2) {
      throw new BadRequestException(
        'SplitRouter currently supports exactly two recipients.',
      );
    }

    const percentageTotal = dto.recipients.reduce(
      (sum, recipient) => sum + Math.round(recipient.percentage * 100),
      0,
    );

    if (percentageTotal !== 10000) {
      throw new BadRequestException(
        'Recipient percentages must total exactly 100%.',
      );
    }

    const totalSatoshis = toSatoshis(dto.totalAmount);

    const firstPercentage = BigInt(
      Math.round(dto.recipients[0].percentage * 100),
    );

    const firstAmount =
      (totalSatoshis * firstPercentage) / 10000n;

    const secondAmount = totalSatoshis - firstAmount;

    const plan = this.splitRouter.prepare({
      recipients: [
        {
          name: dto.recipients[0].name,
          address: dto.recipients[0].address,
          amountBch: toBch(firstAmount),
        },
        {
          name: dto.recipients[1].name,
          address: dto.recipients[1].address,
          amountBch: toBch(secondAmount),
        },
      ],
    });

    const contract = await this.splitRouter.getContractAddress(plan);

    return {
      totalAmount: toBch(totalSatoshis),
      percentageTotal: 100,
      allocations: plan.recipients.map((recipient) => ({
        name: recipient.name,
        address: recipient.address,
        amount: toBch(recipient.amountSatoshis),
        amountSatoshis: recipient.amountSatoshis.toString(),
      })),
      totalSatoshis: plan.totalSatoshis.toString(),
      minerFeeSatoshis: plan.minerFeeSatoshis.toString(),
      requiredFundingSatoshis:
        plan.requiredFundingSatoshis.toString(),
      network: contract.network,
      contractAddress: contract.contractAddress,
      enforcement: 'CASH_SCRIPT_COVENANT',
      status: 'WAITING_FOR_FUNDING',
    };
  }

  async execute(dto: PreviewSplitDto) {
    const preview = await this.preview(dto);

    const plan = this.splitRouter.prepare({
      recipients: preview.allocations.map((recipient) => ({
        name: recipient.name,
        address: recipient.address,
        amountBch: recipient.amount,
      })),
    });

    return this.splitRouter.execute(plan);
  }
}