import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttachmentLibraryService } from './attachment-library.service';
import { AttachmentLibraryController } from './attachment-library.controller';

@Module({
  imports: [AuthModule],
  controllers: [AttachmentLibraryController],
  providers: [AttachmentLibraryService],
  exports: [AttachmentLibraryService],
})
export class AttachmentLibraryModule {}
