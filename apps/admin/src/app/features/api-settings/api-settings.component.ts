import { Component, OnInit, Inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiConfigService } from '../../core/services/api-config.service';
import { ApiConfig } from '../../core/models/admin.models';

@Component({
  standalone: false,
  selector: 'app-api-config-dialog',
  template: `
    <h2 mat-dialog-title>Configure {{ data.config.provider }}</h2>
    <mat-dialog-content style="min-width:420px">
      <p class="note"><mat-icon style="vertical-align:middle;font-size:16px">info</mat-icon>
        Sensitive API keys are masked. Enter new values only if you want to update them.</p>
      <form [formGroup]="form">
        <ng-container *ngFor="let key of configKeys">
          <mat-form-field appearance="outline" class="full-width" style="margin-bottom:8px">
            <mat-label>{{ key }}</mat-label>
            <input matInput [formControlName]="key"
                   [type]="isSensitive(key) ? 'password' : 'text'"
                   [placeholder]="isSensitive(key) ? '••••••••' : ''">
            <mat-hint *ngIf="isSensitive(key)">Leave blank to keep existing value</mat-hint>
          </mat-form-field>
        </ng-container>
        <mat-form-field appearance="outline" class="full-width" *ngIf="data.config.type === 'hotel_supplier'">
          <mat-label>Markup Percent</mat-label>
          <input matInput type="number" formControlName="markupPercent" min="0" max="100">
        </mat-form-field>
        <mat-slide-toggle formControlName="isActive" color="primary" style="margin-top:8px">Active</mat-slide-toggle>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.note { font-size: 13px; color: rgba(0,0,0,0.6); margin-bottom: 16px; }`]
})
export class ApiConfigDialog {
  form: FormGroup;
  configKeys: string[] = [];
  sensitiveKeys = ['apiKey', 'secretKey', 'password', 'token', 'secret', 'apiSecret', 'clientSecret'];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ApiConfigDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { config: ApiConfig }
  ) {
    const cfg = data.config.config || {};
    this.configKeys = Object.keys(cfg);
    const formDef: Record<string, any> = {};
    this.configKeys.forEach(k => { formDef[k] = [this.isSensitive(k) ? '' : cfg[k]]; });
    formDef['markupPercent'] = [data.config.markupPercent || 0];
    formDef['isActive'] = [data.config.isActive];
    this.form = this.fb.group(formDef);
  }

  isSensitive(key: string): boolean {
    return this.sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()));
  }

  save() {
    const val = this.form.value;
    const config: Record<string, any> = {};
    this.configKeys.forEach(k => { if (val[k]) config[k] = val[k]; });
    this.dialogRef.close({ config, markupPercent: val.markupPercent, isActive: val.isActive });
  }
}

@Component({
  standalone: false,
  selector: 'app-api-settings',
  templateUrl: './api-settings.component.html',
  styleUrls: ['./api-settings.component.scss'],
})
export class ApiSettingsComponent implements OnInit {
  configs: ApiConfig[] = [];
  loading = false;
  testResults: Record<string, { success: boolean; message: string }> = {};
  testing: Record<string, boolean> = {};

  providers = [
    { key: 'tbo', name: 'TBO', icon: 'hotel', type: 'hotel_supplier' },
    { key: 'paytabs', name: 'PayTabs', icon: 'payment', type: 'payment' },
    { key: 'ses', name: 'AWS SES', icon: 'email', type: 'email' },
    { key: 'twilio', name: 'Twilio', icon: 'sms', type: 'sms' },
    { key: 'google_maps', name: 'Google Maps', icon: 'map', type: 'maps' },
  ];

  constructor(
    private apiConfigService: ApiConfigService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() { this.loadConfigs(); }

  loadConfigs() {
    this.loading = true;
    this.apiConfigService.list().subscribe({
      next: (res) => { this.configs = (res as any).data || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  getConfig(provider: string): ApiConfig | undefined {
    return this.configs.find(c => c.provider === provider);
  }

  openConfigure(provider: string) {
    const existing = this.getConfig(provider);
    const pInfo = this.providers.find(p => p.key === provider);
    const config: ApiConfig = existing || {
      _id: '', provider, type: pInfo?.type || 'other', isActive: false,
      config: {}, markupPercent: 0
    };
    const ref = this.dialog.open(ApiConfigDialog, { width: '480px', data: { config } });
    ref.afterClosed().subscribe(dto => {
      if (dto) {
        this.apiConfigService.update(provider, dto).subscribe({
          next: () => { this.snackBar.open('Configuration saved', 'OK', { duration: 2000 }); this.loadConfigs(); },
          error: () => this.snackBar.open('Failed to save', 'OK', { duration: 2000 })
        });
      }
    });
  }

  testConnection(provider: string) {
    this.testing[provider] = true;
    this.apiConfigService.test(provider).subscribe({
      next: (res) => {
        this.testResults[provider] = { success: true, message: 'Connection successful' };
        this.testing[provider] = false;
      },
      error: (err) => {
        this.testResults[provider] = { success: false, message: err?.error?.message || 'Connection failed' };
        this.testing[provider] = false;
      }
    });
  }
}
