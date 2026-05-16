import { Component, OnInit, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CmsService } from '../../../core/services/cms.service';
import { CmsBanner } from '../../../core/models/cms.models';

@Component({
  standalone: false,
  selector: 'app-banner-form-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.banner ? 'Edit Banner' : 'New Banner' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="banner-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Title</mat-label><input matInput formControlName="title">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Image URL</mat-label><input matInput formControlName="imageUrl">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Link URL</mat-label><input matInput formControlName="linkUrl">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Alt Text</mat-label><input matInput formControlName="altText">
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:120px">
          <mat-label>Sort Order</mat-label><input matInput type="number" formControlName="sortOrder">
        </mat-form-field>
        <div class="toggle-row">
          <mat-slide-toggle formControlName="isActive" color="primary">Active</mat-slide-toggle>
        </div>
        <div class="schedule-row">
          <mat-form-field appearance="outline">
            <mat-label>Scheduled From</mat-label><input matInput type="date" formControlName="scheduledFrom">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Scheduled To</mat-label><input matInput type="date" formControlName="scheduledTo">
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.banner-form { display: flex; flex-direction: column; gap: 8px; min-width: 400px; } .toggle-row { padding: 4px 0; } .schedule-row { display: flex; gap: 12px; }`]
})
export class BannerFormDialog {
  form: FormGroup;
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<BannerFormDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { banner?: CmsBanner }
  ) {
    const b = data.banner;
    this.form = this.fb.group({
      title: [b?.title || '', Validators.required],
      imageUrl: [b?.imageUrl || '', Validators.required],
      linkUrl: [b?.linkUrl || ''],
      altText: [b?.altText || ''],
      sortOrder: [b?.sortOrder || 0],
      isActive: [b?.isActive ?? true],
      scheduledFrom: [b?.scheduledFrom || ''],
      scheduledTo: [b?.scheduledTo || ''],
    });
  }
  save() { if (this.form.valid) this.dialogRef.close(this.form.value); }
}

@Component({
  standalone: false,
  selector: 'app-cms-banners',
  templateUrl: './cms-banners.component.html',
  styleUrls: ['./cms-banners.component.scss'],
})
export class CmsBannersComponent implements OnInit {
  banners: CmsBanner[] = [];
  loading = false;
  displayedColumns = ['title', 'image', 'isActive', 'sortOrder', 'actions'];

  constructor(private cmsService: CmsService, private dialog: MatDialog, private snackBar: MatSnackBar) {}

  ngOnInit() { this.loadBanners(); }

  loadBanners() {
    this.loading = true;
    this.cmsService.getBanners().subscribe({
      next: (res) => { this.banners = (res as any).data || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openForm(banner?: CmsBanner) {
    const ref = this.dialog.open(BannerFormDialog, { width: '480px', data: { banner } });
    ref.afterClosed().subscribe(dto => {
      if (dto) {
        const obs = banner ? this.cmsService.updateBanner(banner._id, dto) : this.cmsService.createBanner(dto);
        obs.subscribe({
          next: () => { this.snackBar.open('Saved', 'OK', { duration: 2000 }); this.loadBanners(); },
          error: () => this.snackBar.open('Failed', 'OK', { duration: 2000 })
        });
      }
    });
  }

  deleteBanner(id: string) {
    this.cmsService.deleteBanner(id).subscribe({
      next: () => { this.snackBar.open('Deleted', 'OK', { duration: 2000 }); this.loadBanners(); },
      error: () => this.snackBar.open('Failed', 'OK', { duration: 2000 })
    });
  }
}
