import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CandidatesService } from './candidates.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';

//  Multer config 
// Using memoryStorage so the buffer is available for both validation and
// the storage service
const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB hard stop (multer-level)
    files: 1,
  },
};

@Controller('candidates')
export class CandidateController {
  constructor(private readonly candidatesService: CandidatesService) {}

  //  POST /candidates/apply
  @Post('apply')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('resume', multerOptions))
  async apply(
    @Body() dto: CreateCandidateDto,
    @UploadedFile(FileValidationPipe) resume?: Express.Multer.File,
  ) {
    return this.candidatesService.submitApplication(dto, resume);
  }

  //  GET /candidates
  @Get()
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('status') status?: string,
  ) {
    return this.candidatesService.findAll({
      skip: skip ? parseInt(skip, 10) : 0,
      take: take ? parseInt(take, 10) : 20,
      status,
    });
  }

  //  GET /candidates/queue/stats
  @Get('queue/stats')
  queueStats() {
    return this.candidatesService.getQueueStats();
  }

  //  GET /candidates/:id
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.findOne(id);
  }
}