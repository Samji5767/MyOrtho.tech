import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { AuthModule } from '../auth/auth.module';
import { StlProcessingController } from './stl-processing.controller';
import { StlProcessingService } from './stl-processing.service';

const UPLOAD_DIR = process.env.UPLOADS_DIR ?? '/app/uploads';

@Module({
  imports: [
    AuthModule,
    MulterModule.register({
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(UPLOAD_DIR, 'stl', 'tmp');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        },
      }),
      limits: { fileSize: 500 * 1024 * 1024 },
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
  controllers: [StlProcessingController],
  providers: [StlProcessingService],
  exports: [StlProcessingService],
})
export class StlProcessingModule {}
