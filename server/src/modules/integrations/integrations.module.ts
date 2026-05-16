import { Module } from '@nestjs/common';
import { PaytabsModule } from './paytabs/paytabs.module';
import { TboModule } from './tbo/tbo.module';

@Module({
  imports: [PaytabsModule, TboModule],
  exports: [PaytabsModule, TboModule],
})
export class IntegrationsModule {}
