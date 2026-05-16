import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaytabsService } from './paytabs.service';

@Module({
  imports: [ConfigModule],
  providers: [PaytabsService],
  exports: [PaytabsService],
})
export class PaytabsModule {}
