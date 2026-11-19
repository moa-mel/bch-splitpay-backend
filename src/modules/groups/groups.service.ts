import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        targetAmount: dto.targetAmount,
        creatorAddress: dto.creatorAddress,
      },
      include: { contributions: true },
    });
  }

  list() {
    return this.prisma.group.findMany({
      include: { contributions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addContribution(groupId: string, dto: CreateContributionDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { contributions: true },
    });
    if (!group) throw new NotFoundException('Group not found.');
    if (group.status !== 'OPEN') {
      throw new NotFoundException('This group is not accepting contributions.');
    }

    // A record here is not proof of an on-chain payment. Chipnet verification
    // must confirm the transaction before a contribution is marked confirmed.
    return this.prisma.contribution.create({
      data: {
        groupId,
        contributor: dto.contributor,
        amount: dto.amount,
        transactionId: dto.transactionId,
        confirmed: false,
      },
    });
  }
}
