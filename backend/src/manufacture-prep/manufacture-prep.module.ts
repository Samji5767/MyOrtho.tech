import { Module } from '@nestjs/common';
import { ManufacturePrepService } from './manufacture-prep.service';
import { ManufacturePrepController } from './manufacture-prep.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ManufacturePrepService],
  controllers: [ManufacturePrepController],
})
export class ManufacturePrepModule {}
