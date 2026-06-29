import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommandPaletteService } from './command-palette.service';
import { CommandPaletteController } from './command-palette.controller';

@Module({
  imports: [AuthModule],
  controllers: [CommandPaletteController],
  providers: [CommandPaletteService],
  exports: [CommandPaletteService],
})
export class CommandPaletteModule {}
