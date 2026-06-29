import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MaterialTestingService } from './material-testing.service';
import { MaterialTestingController } from './material-testing.controller';

@Module({
  imports: [AuthModule],
  controllers: [MaterialTestingController],
  providers: [MaterialTestingService],
  exports: [MaterialTestingService],
})
export class MaterialTestingModule {}
