import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { File as MulterFile } from 'multer';


export interface UploadResult {
  key: string;      // storage key / S3 object key
  url: string;      // publicly accessible URL (or local path)
  size: number;     // bytes
  mimetype: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly mode: string;
  private readonly uploadDest: string;

  constructor() {
    this.mode = process.env.STORAGE_MODE ?? 'local';
    this.uploadDest = process.env.UPLOAD_DEST ?? './uploads';
  }

  //  Public API

  async upload(file: MulterFile): Promise<UploadResult> {
    if (this.mode === 's3') {
      return this.uploadToS3(file);
    }
    return this.uploadLocally(file);
  }

  async delete(key: string): Promise<void> {
    if (this.mode === 's3') {
      return this.deleteFromS3(key);
    }
    return this.deleteLocally(key);
  }

  //  Local (mock S3) 
  private async uploadLocally(file: MulterFile): Promise<UploadResult> {
    const ext = path.extname(file.originalname);
    const key = `resumes/${randomUUID()}${ext}`;
    const dest = path.join(this.uploadDest, key);

    // Ensure directory exists
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.buffer);

    this.logger.log(`[local] Saved file -> ${dest} (${file.size} bytes)`);

    return {
      key,
      url: dest,          
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  private async deleteLocally(key: string): Promise<void> {
    const filePath = path.join(this.uploadDest, key);
    try {
      await fs.unlink(filePath);
      this.logger.log(`[local] Deleted file: ${filePath}`);
    } catch (err) {
      this.logger.warn(`[local] Could not delete ${filePath}: ${(err as Error).message}`);
    }
  }

  //  AWS S3 

  private async uploadToS3(_file: MulterFile): Promise<UploadResult> {
    throw new InternalServerErrorException(
      'S3 storage is not configured in this build.',
    );
  }

  private async deleteFromS3(key: string): Promise<void> {
    this.logger.warn(`[s3] deleteFromS3 not configured for key: ${key}`);
  }
}
