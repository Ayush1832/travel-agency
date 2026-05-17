import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule, ConfigModule],
  controllers: [HotelsController],
  providers: [HotelsService],
  exports: [HotelsService],
})
export class HotelsModule {}
