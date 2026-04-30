import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  CANDIDATE_QUEUE,
  JOB_TYPES,
  ProcessApplicationPayload,
} from '../queue/queue.constants';
import { CreateCandidateDto } from './dto/create-candidate.dto';

@Injectable()
export class CandidateService {
  private readonly logger = new Logger(CandidateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(CANDIDATE_QUEUE) private readonly candidateQueue: Queue,
  ) {}

  //  Submit new application 
  async submitApplication(
    dto: CreateCandidateDto,
    resumeFile?: Express.Multer.File,
  ) {
    this.logger.log(
      `New application: ${dto.firstName} ${dto.lastName} <${dto.email}> → ${dto.position}`,
    );

    // 1. Upload resume (if provided)
    let resumeUrl: string | null = null;
    if (resumeFile) {
      const upload = await this.storage.upload(resumeFile);
      resumeUrl = upload.url;
      this.logger.log(`Resume uploaded → ${upload.key} (${upload.size} bytes)`);
    }

    // 2. Persist to database
    let candidate: Awaited<ReturnType<typeof this.prisma.candidate.create>>;
    try {
      candidate = await this.prisma.candidate.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          position: dto.position,
          yearsOfExp: dto.yearsOfExp,
          coverLetter: dto.coverLetter,
          resumeUrl,
          status: 'PENDING',
        },
      });
      this.logger.log(`Candidate persisted: id=${candidate.id}`);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Unique constraint on email
        throw new ConflictException(
          `An application with email "${dto.email}" already exists.`,
        );
      }
      throw err;
    }

    // 3. Enqueue background processing job
    const payload: ProcessApplicationPayload = {
      candidateId: candidate.id,
      email: candidate.email,
      position: candidate.position,
      resumeUrl: candidate.resumeUrl,
      submittedAt: candidate.createdAt.toISOString(),
    };

    const job = await this.candidateQueue.add(
      JOB_TYPES.PROCESS_APPLICATION,
      payload,
      {
        // Job-level options (override queue defaults)
        priority: this.resolvePriority(dto.yearsOfExp),
        delay: 0,
      },
    );

    this.logger.log(
      `Job enqueued: id=${job.id} type="${JOB_TYPES.PROCESS_APPLICATION}"`,
    );

    return {
      message: 'Application submitted successfully',
      candidateId: candidate.id,
      jobId: job.id,
      status: candidate.status,
    };
  }

  //  Find all candidates

  async findAll(params: { skip?: number; take?: number; status?: string } = {}) {
    const { skip = 0, take = 20, status } = params;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.candidate.findMany({
        skip,
        take,
        where: status ? { status: status as Prisma.EnumApplicationStatusFilter } : undefined,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          status: true,
          yearsOfExp: true,
          createdAt: true,
        },
      }),
      this.prisma.candidate.count({
        where: status ? { status: status as Prisma.EnumApplicationStatusFilter } : undefined,
      }),
    ]);

    return { items, total, skip, take };
  }

  //  Find one candidate

  async findOne(id: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate) throw new NotFoundException(`Candidate ${id} not found`);
    return candidate;
  }

  //  Queue stats (useful for monitoring endpoint) 

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.candidateQueue.getWaitingCount(),
      this.candidateQueue.getActiveCount(),
      this.candidateQueue.getCompletedCount(),
      this.candidateQueue.getFailedCount(),
      this.candidateQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  //  Helpers 

  /**
   * Higher yearsOfExp → lower priority number → processed first in BullMQ.
   * Priority 1 (highest) ... 10 (lowest)
   */
  private resolvePriority(yearsOfExp?: number): number {
    if (!yearsOfExp) return 5;
    if (yearsOfExp >= 10) return 1;
    if (yearsOfExp >= 5) return 2;
    if (yearsOfExp >= 2) return 3;
    return 5;
  }
}

