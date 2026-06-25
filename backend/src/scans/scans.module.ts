import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { AuthModule } from '../auth/auth.module';
import { ScansController, SegmentJobsController } from './scans.controller';
import { ScansService } from './scans.service';

const UPLOAD_DIR = process.env.UPLOADS_DIR ?? '/app/uploads';

@Module({
  imports: [
    AuthModule,
    MulterModule.register({
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(UPLOAD_DIR, 'scans', 'tmp');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        },
      }),
      limits: { fileSize: 250 * 1024 * 1024 }, // 250 MB
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.stl', '.obj', '.ply'].includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Only .stl, .obj, and .ply files are accepted'), false);
        }
      },
    }),
  ],
  controllers: [ScansController, SegmentJobsController],
  providers: [ScansService],
  exports: [ScansService],
})
export class ScansModule {}
