import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { SupportRoutingModule } from './support-routing.module';
import { SupportListComponent } from './support-list/support-list.component';
import { CreateTicketComponent } from './create-ticket/create-ticket.component';
import { TicketDetailComponent } from './ticket-detail/ticket-detail.component';

@NgModule({
  declarations: [SupportListComponent, CreateTicketComponent, TicketDetailComponent],
  imports: [SharedModule, SupportRoutingModule],
})
export class SupportModule {}
