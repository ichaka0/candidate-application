import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';


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

  constructor(private readonly config: ConfigService) {
    this.mode = config.get<string>('STORAGE_MODE', 'local');
    this.uploadDest = config.get<string>('UPLOAD_DEST', './uploads');
  }

  //  Public API

  async upload(file: Express.Multer.File): Promise<UploadResult> {
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
  private async uploadLocally(file: Express.Multer.File): Promise<UploadResult> {
    const ext = path.extname(file.originalname);
    const key = `resumes/${uuidv4()}${ext}`;
    const dest = path.join(this.uploadDest, key);

    // Ensure directory exists
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.buffer);

    this.logger.log(`[local] Saved file → ${dest} (${file.size} bytes)`);

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

  private async uploadToS3(file: Express.Multer.File): Promise<UploadResult> {

    const ext = path.extname(file.originalname);
    const region = this.config.get('AWS_REGION');
    const bucket = this.config.get('S3_BUCKET_NAME');
   
      const s3 = new S3Client({ region: this.config.get('AWS_REGION') });
      const key = `resumes/${uuidv4()}${ext}`;
     
      await s3.send(new PutObjectCommand({
        Bucket: this.config.get('S3_BUCKET_NAME'),
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private',
      }));

      return {
        key,
        url: `https://${this.config.get('S3_BUCKET_NAME')}.s3.${this.config.get('AWS_REGION')}.amazonaws.com/${key}`,
        size: file.size,
        mimetype: file.mimetype,
      };
  }

  private async deleteFromS3(key: string): Promise<void> {

        const s3 = new S3Client({ region: this.config.get('AWS_REGION') });
        const bucket = this.config.get('S3_BUCKET_NAME');
   
      await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
    
    this.logger.warn(`[s3] deleteFromS3 not implemented for key: ${key}`);
  }
}