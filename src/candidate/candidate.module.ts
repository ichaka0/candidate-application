import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CandidateService } from './candidate.service';
import { CandidateController } from './candidate.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ApplicationProcessor } from '../queue/application.processor';
import { CANDIDATE_QUEUE } from '../queue/queue.constants';
import { ConfigService } from '@nestjs/config/dist/config.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CANDIDATE_QUEUE,
    }),
  ],
  controllers: [CandidateController],
  providers: [
    CandidateService,
    PrismaService,
    StorageService,
    ApplicationProcessor,
    ConfigService,
  ],
})
export class CandidateModule {}
