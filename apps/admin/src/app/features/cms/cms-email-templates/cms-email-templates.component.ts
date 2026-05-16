import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CmsService } from '../../../core/services/cms.service';
import { EmailTemplate } from '../../../core/models/cms.models';

const TEMPLATE_VARIABLES: Record<string, string[]> = {
  booking_confirmation: ['{{bookingRef}}', '{{clientName}}', '{{hotelName}}', '{{checkIn}}', '{{checkOut}}', '{{totalAmount}}'],
  booking_cancellation: ['{{bookingRef}}', '{{clientName}}', '{{hotelName}}', '{{refundAmount}}'],
  welcome: ['{{clientName}}', '{{companyName}}', '{{loginUrl}}'],
  password_reset: ['{{clientName}}', '{{resetUrl}}', '{{expiresIn}}'],
  account_approved: ['{{companyName}}', '{{loginUrl}}'],
  account_rejected: ['{{companyName}}', '{{reason}}'],
  wallet_top_up: ['{{clientName}}', '{{amount}}', '{{newBalance}}'],
  default: ['{{clientName}}', '{{companyName}}'],
};

@Component({
  standalone: false,
  selector: 'app-cms-email-templates',
  templateUrl: './cms-email-templates.component.html',
  styleUrls: ['./cms-email-templates.component.scss'],
})
export class CmsEmailTemplatesComponent implements OnInit {
  templates: EmailTemplate[] = [];
  forms: Record<string, FormGroup> = {};
  expanded: Record<string, boolean> = {};
  loading = false;
  saving: Record<string, boolean> = {};

  constructor(private cmsService: CmsService, private fb: FormBuilder, private snackBar: MatSnackBar) {}

  ngOnInit() { this.loadTemplates(); }

  loadTemplates() {
    this.loading = true;
    this.cmsService.getEmailTemplates().subscribe({
      next: (res) => {
        this.templates = (res as any).data || [];
        this.templates.forEach(t => {
          this.forms[t._id] = this.fb.group({ subject: [t.subject], body: [t.body] });
        });
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  toggleExpand(id: string) { this.expanded[id] = !this.expanded[id]; }

  getVariables(template: EmailTemplate): string[] {
    return TEMPLATE_VARIABLES[template.key] || TEMPLATE_VARIABLES['default'];
  }

  save(template: EmailTemplate) {
    const form = this.forms[template._id];
    if (!form) return;
    this.saving[template._id] = true;
    this.cmsService.updateEmailTemplate(template._id, form.value).subscribe({
      next: () => { this.snackBar.open('Template saved', 'OK', { duration: 2000 }); this.saving[template._id] = false; },
      error: () => { this.snackBar.open('Failed to save', 'OK', { duration: 2000 }); this.saving[template._id] = false; }
    });
  }
}
