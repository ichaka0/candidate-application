export class CreateCandidateDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  yearsOfExp: number | string;
  coverLetterUrl?: string;
}
