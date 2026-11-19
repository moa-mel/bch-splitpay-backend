import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { SplitsModule } from './modules/splits/splits.module';
import { GroupsModule } from './modules/groups/groups.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    SplitsModule,
     GroupsModule
  ],
  controllers: [HealthController],
})
export class AppModule {}
