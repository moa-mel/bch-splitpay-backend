import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { GroupVaultService } from '../contracts/group-vault/group-vault.service';
import { TransactionVerifierService } from '../blockchain/transaction-verifier.service';

import { CreateContributionDto } from './dto/create-contribution.dto';
import { CreateGroupDto } from './dto/create-group.dto';

function toSatoshis(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');

  return (
    BigInt(whole) * 100_000_000n +
    BigInt(fraction.padEnd(8, '0'))
  );
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupVault: GroupVaultService,
    private readonly verifier: TransactionVerifierService,
  ) { }

  async create(dto: CreateGroupDto) {
    if (!dto.creatorAddress) {
      throw new BadRequestException(
        'A beneficiary BCH address is required.',
      );
    }

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        targetAmount: dto.targetAmount,
        creatorAddress: dto.creatorAddress,
      },
      include: {
        contributions: true,
      },
    });

    const plan = this.groupVault.prepare({
      groupId: group.id,
      targetAmountBch: group.targetAmount.toString(),
      beneficiaryAddress: group.creatorAddress!,
    });

    const contract = await this.groupVault.getContractAddress(plan);

    return {
      ...group,
      vaultAddress: contract.contractAddress,
      network: contract.network,
      requiredFundingSatoshis:
        plan.requiredFundingSatoshis.toString(),
    };
  }

  async list() {
    const groups = await this.prisma.group.findMany({
      include: {
        contributions: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return Promise.all(
      groups.map(async (group) => {
        if (!group.creatorAddress) {
          return group;
        }

        const plan = this.groupVault.prepare({
          groupId: group.id,
          targetAmountBch: group.targetAmount.toString(),
          beneficiaryAddress: group.creatorAddress,
        });

        const contract =
          await this.groupVault.getContractAddress(plan);

        return {
          ...group,
          vaultAddress: contract.contractAddress,
          network: contract.network,
          requiredFundingSatoshis:
            plan.requiredFundingSatoshis.toString(),
        };
      }),
    );
  }

  async addContribution(
    groupId: string,
    dto: CreateContributionDto,
  ) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    if (group.status !== 'OPEN') {
      throw new BadRequestException(
        'This group is not accepting contributions.',
      );
    }

    if (!group.creatorAddress) {
      throw new BadRequestException(
        'Group beneficiary address is missing.',
      );
    }

    if (!dto.transactionId) {
      throw new BadRequestException(
        'A BCH transaction ID is required.',
      );
    }

    const plan = this.groupVault.prepare({
      groupId: group.id,
      targetAmountBch: group.targetAmount.toString(),
      beneficiaryAddress: group.creatorAddress,
    });

    const contract = await this.groupVault.getContractAddress(plan);

    const amountSatoshis = toSatoshis(
      dto.amount.toFixed(8),
    );

    const payment = await this.verifier.verifyPaymentOutput(
      dto.transactionId,
      contract.contractAddress,
      amountSatoshis,
    );

    if (!payment.paymentMatches) {
      throw new BadRequestException(
        'The transaction does not pay the expected amount to this GroupVault.',
      );
    }

    const existing = await this.prisma.contribution.findFirst({
      where: {
        groupId,
        transactionId: dto.transactionId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'This transaction has already been recorded for this group.',
      );
    }

    return this.prisma.contribution.create({
      data: {
        groupId,
        contributor: dto.contributor,
        amount: dto.amount,
        transactionId: dto.transactionId,
        confirmed: payment.confirmations > 0,
      },
    });
  }
}