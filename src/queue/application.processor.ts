import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  CANDIDATE_QUEUE,
  JOB_TYPES,
  ProcessApplicationPayload,
} from './queue.constants';

@Processor(CANDIDATE_QUEUE)
export class ApplicationProcessor extends WorkerHost {
  private readonly logger = new Logger(ApplicationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  //  Job dispatcher 

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job [${job.id}] type="${job.name}"`);

    switch (job.name) {
      case JOB_TYPES.PROCESS_APPLICATION:
        return this.handleProcessApplication(job as Job<ProcessApplicationPayload>);

      case JOB_TYPES.SEND_CONFIRMATION_EMAIL:
        return this.handleConfirmationEmail(job);

      case JOB_TYPES.NOTIFY_RECRUITERS:
        return this.handleNotifyRecruiters(job);

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return null;
    }
  }

  // Handlers 

  private async handleProcessApplication(
    job: Job<ProcessApplicationPayload>,
  ): Promise<{ processed: boolean }> {
    const { candidateId, email, position, resumeUrl } = job.data;

    this.logger.log(
      `[process-application] candidateId=${candidateId} position="${position}"`,
    );

    
    await this.simulateWork(800, 'Parsing resume');

    
    await this.simulateWork(400, 'Running screening rules');

    
    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        status: 'UNDER_REVIEW',
        metadata: {
          processedAt: new Date().toISOString(),
          processorJobId: job.id,
          resumeParsed: resumeUrl !== null,
        },
      },
    });

    this.logger.log(
      `[process-application] ✓ candidateId=${candidateId} → status=UNDER_REVIEW`,
    );


    return { processed: true };
  }

  private async handleConfirmationEmail(job: Job): Promise<void> {
    this.logger.log(`[send-confirmation-email] to=${job.data.email}`);
    // Wire up nodemailer / SendGrid / SES here
    await this.simulateWork(300, 'Sending confirmation email');
    this.logger.log(`[send-confirmation-email]  sent to ${job.data.email}`);
  }

  private async handleNotifyRecruiters(job: Job): Promise<void> {
    this.logger.log(`[notify-recruiters] position="${job.data.position}"`);
    await this.simulateWork(200, 'Notifying recruiters via Slack/email');
    this.logger.log(`[notify-recruiters]  done`);
  }

  //  Worker lifecycle events 

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: unknown) {
    this.logger.log(
      ` Job [${job.id}] "${job.name}" completed in ${job.processedOn! - job.timestamp}ms`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      ` Job [${job.id}] "${job.name}" failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${error.message}`,
    );
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(` Job [${job.id}] progress: ${progress}%`);
  }

  // Helpers

  private simulateWork(ms: number, label: string): Promise<void> {
    this.logger.debug(` ${label} (~${ms}ms)`);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}