import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SupportListComponent } from './support-list/support-list.component';
import { CreateTicketComponent } from './create-ticket/create-ticket.component';
import { TicketDetailComponent } from './ticket-detail/ticket-detail.component';

const routes: Routes = [
  { path: '', component: SupportListComponent },
  { path: 'new', component: CreateTicketComponent },
  { path: ':id', component: TicketDetailComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SupportRoutingModule {}
