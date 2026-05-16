import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { SetCreditLimitDialog } from './dialogs/set-credit-limit.dialog';
import { TopUpWalletDialog } from './dialogs/top-up-wallet.dialog';
import { RecordSettlementDialog } from './dialogs/record-settlement.dialog';
import { ConfirmActionDialog } from './dialogs/confirm-action.dialog';

const routes: Routes = [
  { path: '', component: ClientsListComponent },
  { path: ':id', component: ClientDetailComponent },
];

@NgModule({
  declarations: [
    ClientsListComponent,
    ClientDetailComponent,
    SetCreditLimitDialog,
    TopUpWalletDialog,
    RecordSettlementDialog,
    ConfirmActionDialog,
  ],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ClientsModule {}
