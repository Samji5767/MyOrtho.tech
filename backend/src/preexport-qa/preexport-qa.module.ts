import { Module } from '@nestjs/common';
import { PreexportQaService } from './preexport-qa.service';
import { PreexportQaController } from './preexport-qa.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [PreexportQaService],
  controllers: [PreexportQaController],
})
export class PreexportQaModule {}
