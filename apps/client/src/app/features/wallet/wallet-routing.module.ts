import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WalletDashboardComponent } from './wallet-dashboard/wallet-dashboard.component';

const routes: Routes = [{ path: '', component: WalletDashboardComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WalletRoutingModule {}
