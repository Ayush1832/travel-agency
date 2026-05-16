import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { WalletRoutingModule } from './wallet-routing.module';
import { WalletDashboardComponent } from './wallet-dashboard/wallet-dashboard.component';
import { RedeemDialogComponent } from './wallet-dashboard/redeem-dialog.component';

@NgModule({
  declarations: [WalletDashboardComponent, RedeemDialogComponent],
  imports: [SharedModule, WalletRoutingModule],
})
export class WalletModule {}
