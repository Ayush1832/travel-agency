import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { CmsService } from '../../../core/services/cms.service';
import { CmsPage } from '../../../core/models/cms.models';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  standalone: false,
  selector: 'app-cms-pages',
  templateUrl: './cms-pages.component.html',
  styleUrls: ['./cms-pages.component.scss'],
})
export class CmsPagesComponent implements OnInit {
  pages: CmsPage[] = [];
  loading = false;
  displayedColumns = ['title', 'slug', 'isPublished', 'updatedAt', 'actions'];

  constructor(
    private cmsService: CmsService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit() { this.loadPages(); }

  loadPages() {
    this.loading = true;
    this.cmsService.getPages().subscribe({
      next: (res) => { this.pages = (res as any).data || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  editPage(page: CmsPage) {
    this.router.navigate(['/cms/pages', page._id, 'edit']);
  }

  newPage() {
    this.router.navigate(['/cms/pages/new/edit']);
  }

  togglePublish(page: CmsPage) {
    this.cmsService.updatePage(page._id, { isPublished: !page.isPublished }).subscribe({
      next: () => { this.snackBar.open(`Page ${page.isPublished ? 'unpublished' : 'published'}`, 'OK', { duration: 2000 }); this.loadPages(); },
      error: () => this.snackBar.open('Failed', 'OK', { duration: 2000 })
    });
  }

  deletePage(page: CmsPage) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: { title: 'Delete Page', message: `Delete "${page.title}"? This cannot be undone.`, confirmLabel: 'Delete', confirmColor: 'warn' }
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) {
        this.cmsService.deletePage(page._id).subscribe({
          next: () => { this.snackBar.open('Page deleted', 'OK', { duration: 2000 }); this.loadPages(); },
          error: () => this.snackBar.open('Failed to delete', 'OK', { duration: 2000 })
        });
      }
    });
  }
}
