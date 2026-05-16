import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { CreditOverviewComponent } from './credit-overview/credit-overview.component';

const routes: Routes = [
  { path: '', component: CreditOverviewComponent },
];

@NgModule({
  declarations: [CreditOverviewComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class CreditModule {}
