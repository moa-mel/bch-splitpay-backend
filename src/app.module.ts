import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { SplitsModule } from './modules/splits/splits.module';
import { GroupsModule } from './modules/groups/groups.module';
import { ConfigModule } from '@nestjs/config';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { ContractsModule } from './modules/contracts/contracts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    SplitsModule,
     GroupsModule,
     ContractsModule,
    BlockchainModule,
    InvitationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
