# Candidate Application Pipeline

A NestJS mini pipeline for processing candidate applications end-to-end:
**HTTP → Validate → Upload resume → PostgreSQL → BullMQ background job**

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 |
| ORM | Prisma 5 + PostgreSQL |
| Queue | BullMQ (Redis-backed) |
| File storage | Local mock / AWS S3 (swap via `.env`) |
| Validation | class-validator + class-transformer |
| Testing | Jest |

---

## Quick start

### 1. Infrastructure

```bash
docker compose up -d
# starts PostgreSQL on :5432 and Redis on :6379
```

### 2. Environment

```bash
cp .env.example .env
# Edit DATABASE_URL / Redis settings if needed
```

### 3. Install & migrate

```bash
npm install

# Generate Prisma client
npx prisma generate

# Create tables
npx prisma migrate dev --name init

# (Optional) seed sample data
npx ts-node prisma/seed.ts
```

### 4. Run

```bash
npm run start:dev
# API available at http://localhost:3000/api/v1
```

---

## API endpoints

### Submit an application

```bash
POST /api/v1/candidates/apply
Content-Type: multipart/form-data

# Fields:
#   firstName     string (required)
#   lastName      string (required)
#   email         email  (required, unique)
#   position      enum   (required) — see Position enum
#   yearsOfExp    int    (optional, 0-50)
#   coverLetter   string (optional)
#   resume        file   (optional, PDF/DOC/DOCX, max 10 MB)
```

**curl example — no resume:**
```bash
curl -X POST http://localhost:3000/api/v1/candidates/apply \
  -F "firstName=Ada" \
  -F "lastName=Lovelace" \
  -F "email=ada@example.com" \
  -F "position=backend-engineer" \
  -F "yearsOfExp=8"
```

**curl example — with resume:**
```bash
curl -X POST http://localhost:3000/api/v1/candidates/apply \
  -F "firstName=Alan" \
  -F "lastName=Turing" \
  -F "email=alan@example.com" \
  -F "position=fullstack-engineer" \
  -F "yearsOfExp=10" \
  -F "resume=@./cv.pdf"
```

**Response 201:**
```json
{
  "message": "Application submitted successfully",
  "candidateId": "550e8400-e29b-41d4-a716-446655440000",
  "jobId": "1",
  "status": "PENDING"
}
```

---

### List candidates

```bash
GET /api/v1/candidates?skip=0&take=20&status=PENDING
```

### Get candidate by ID

```bash
GET /api/v1/candidates/:id
```

### Queue statistics

```bash
GET /api/v1/candidates/queue/stats
```

**Response:**
```json
{
  "waiting": 2,
  "active": 1,
  "completed": 47,
  "failed": 0,
  "delayed": 0
}
```

---

## Data flow

```
POST /apply (multipart/form-data)
      │
      ▼
CandidatesController
  ├─ @UseInterceptors(FileInterceptor)   ← multer parses the file
  └─ @UploadedFile(FileValidationPipe)  ← checks MIME + size
      │
      ▼
CandidatesService.submitApplication()
  │
  ├─ 1. StorageService.upload(file)     ← saves to ./uploads/ (or S3)
  │
  ├─ 2. prisma.candidate.create(...)    ← persisted to PostgreSQL
  │         status = PENDING
  │
  └─ 3. queue.add('process-application', payload)
              │
              ▼ (async, Redis-backed)
        ApplicationProcessor.process()
          ├─ Resume parsing (simulated)
          ├─ Screening rules
          └─ prisma.candidate.update()  ← status = UNDER_REVIEW
```

---

## Switching to real AWS S3

1. Install the SDK:
   ```bash
   npm install @aws-sdk/client-s3
   ```

2. Set `.env`:
   ```
   STORAGE_MODE=s3
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   S3_BUCKET_NAME=candidate-resumes
   ```

3. Uncomment the S3 implementation in `src/storage/storage.service.ts`.

---

## Available positions

| Value | Description |
|---|---|
| `backend-engineer` | Backend / systems |
| `frontend-engineer` | Frontend |
| `fullstack-engineer` | Full-stack |
| `data-engineer` | Data / ML |
| `devops-engineer` | DevOps / infrastructure |
| `product-manager` | Product |
| `designer` | Design |
| `other` | Other |

---

## Running tests

```bash
# Unit tests (no live DB or Redis needed)
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov
```

---

## Project structure

```
candidate-pipeline/
├── prisma/
│   ├── schema.prisma          # Candidate + JobApplication models
│   └── seed.ts                # Sample data seeder
├── src/
│   ├── main.ts                # NestJS bootstrap
│   ├── app.module.ts          # Root module (BullMQ, ConfigModule)
│   ├── prisma/
│   │   ├── prisma.module.ts   # Global Prisma module
│   │   └── prisma.service.ts  # PrismaClient wrapper
│   ├── storage/
│   │   ├── storage.module.ts
│   │   └── storage.service.ts # Local mock + S3 strategy
│   ├── queue/
│   │   ├── queue.constants.ts # Queue name, job types, payload types
│   │   ├── queue.module.ts    # BullMQ registration
│   │   └── application.processor.ts  # Background worker
│   ├── candidates/
│   │   ├── candidates.module.ts
│   │   ├── candidates.controller.ts  # REST endpoints
│   │   ├── candidates.service.ts     # Business logic
│   │   ├── candidates.service.spec.ts # Unit tests
│   │   └── dto/
│   │       └── create-candidate.dto.ts
│   └── common/
│       └── pipes/
│           └── file-validation.pipe.ts  # MIME + size guard
├── docker-compose.yml         # PostgreSQL + Redis
├── .env.example
└── package.json
```