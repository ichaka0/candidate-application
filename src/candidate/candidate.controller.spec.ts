import { Test, TestingModule } from '@nestjs/testing';
import { CandidateService } from './candidate.service';
import { CandidateController } from './candidate.controller';

describe('CandidateController', () => {
  let controller: CandidateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CandidateController],
      providers: [
        {
          provide: CandidateService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CandidateController>(CandidateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
