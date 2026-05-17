import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { LoyaltySettingsComponent } from './loyalty-settings.component';

const routes: Routes = [
  { path: '', component: LoyaltySettingsComponent },
];

@NgModule({
  declarations: [LoyaltySettingsComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class LoyaltyModule {}
