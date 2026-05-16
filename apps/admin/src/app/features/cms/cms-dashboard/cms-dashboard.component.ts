import { Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-cms-dashboard',
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 style="font-size:24px;font-weight:600;color:#311b92">CMS</h1>
      </div>
      <div class="cms-nav-grid">
        <mat-card class="cms-nav-card" routerLink="/cms/pages" style="cursor:pointer">
          <mat-card-content>
            <mat-icon>article</mat-icon>
            <h3>Pages</h3>
            <p>Manage website pages</p>
          </mat-card-content>
        </mat-card>
        <mat-card class="cms-nav-card" routerLink="/cms/banners" style="cursor:pointer">
          <mat-card-content>
            <mat-icon>image</mat-icon>
            <h3>Banners</h3>
            <p>Manage promotional banners</p>
          </mat-card-content>
        </mat-card>
        <mat-card class="cms-nav-card" routerLink="/cms/email-templates" style="cursor:pointer">
          <mat-card-content>
            <mat-icon>email</mat-icon>
            <h3>Email Templates</h3>
            <p>Customize email templates</p>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .cms-nav-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .cms-nav-card { border-radius: 12px !important; text-align: center; transition: box-shadow 0.2s; &:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.15); } mat-icon { font-size: 48px; width: 48px; height: 48px; color: #311b92; margin-bottom: 12px; } h3 { font-size: 18px; font-weight: 600; } p { color: rgba(0,0,0,0.6); font-size: 14px; margin-top: 8px; } }
  `]
})
export class CmsDashboardComponent {}
