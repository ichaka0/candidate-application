export const CANDIDATE_QUEUE = 'CANDIDATE_QUEUE';

export const JOB_TYPES = {
  PROCESS_APPLICATION: 'PROCESS_APPLICATION',
  SEND_CONFIRMATION_EMAIL: 'SEND_CONFIRMATION_EMAIL',
  NOTIFY_RECRUITERS: 'NOTIFY_RECRUITERS',
};

export type ProcessApplicationPayload = {
  candidateId: string;
  email: string;
  position: string;
  resumeUrl: string | null;
  submittedAt: string;
};
