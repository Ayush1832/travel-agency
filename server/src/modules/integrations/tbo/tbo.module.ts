import { Module } from '@nestjs/common';
import { TboService } from './tbo.service';

@Module({
  providers: [TboService],
  exports: [TboService],
})
export class TboModule {}
