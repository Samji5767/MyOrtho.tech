import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlignerDesignController } from './aligner-design.controller';
import { AlignerDesignService } from './aligner-design.service';

@Module({
  imports: [AuthModule],
  controllers: [AlignerDesignController],
  providers: [AlignerDesignService],
  exports: [AlignerDesignService],
})
export class AlignerDesignModule {}
