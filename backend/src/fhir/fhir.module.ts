import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FhirService } from './fhir.service';
import { FhirController } from './fhir.controller';

@Module({
  imports: [AuthModule],
  controllers: [FhirController],
  providers: [FhirService],
  exports: [FhirService],
})
export class FhirModule {}
