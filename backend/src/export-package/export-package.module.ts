import { Module } from '@nestjs/common';
import { ExportPackageService } from './export-package.service';
import { ExportPackageController } from './export-package.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ExportPackageService],
  controllers: [ExportPackageController],
})
export class ExportPackageModule {}
