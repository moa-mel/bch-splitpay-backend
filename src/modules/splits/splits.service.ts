import { BadRequestException, Injectable } from '@nestjs/common';
import { PreviewSplitDto } from './dto/preview-split.dto';

@Injectable()
export class SplitsService {
  preview(dto: PreviewSplitDto) {
    const percentageTotal = dto.recipients.reduce((sum, item) => sum + item.percentage, 0);
    if (Math.abs(percentageTotal - 100) > 0.000001) {
      throw new BadRequestException('Recipient percentages must total exactly 100%.');
    }

    const allocations = dto.recipients.map((recipient) => {
      const amount = Math.floor(dto.totalAmount * recipient.percentage * 1e8 / 100) / 1e8;
      return { ...recipient, amount };
    });

    const allocated = allocations.reduce((sum, item) => sum + item.amount, 0);
    const remainder = Number((dto.totalAmount - allocated).toFixed(8));

    return {
      totalAmount: dto.totalAmount,
      percentageTotal,
      allocations,
      roundingRemainder: remainder,
      enforcement: 'PREVIEW_ONLY',
      warning: 'This calculation is informational. The XO SplitRouter template must enforce transaction outputs on-chain.',
    };
  }
}
