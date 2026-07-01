import { Module } from '@nestjs/common';
import { AlignerDesignController } from './aligner-design.controller';
import { AlignerDesignService } from './aligner-design.service';

@Module({
  controllers: [AlignerDesignController],
  providers: [AlignerDesignService],
  exports: [AlignerDesignService],
})
export class AlignerDesignModule {}
