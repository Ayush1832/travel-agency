import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CmsService } from '../../../core/services/cms.service';

@Component({
  standalone: false,
  selector: 'app-cms-page-editor',
  templateUrl: './cms-page-editor.component.html',
  styleUrls: ['./cms-page-editor.component.scss'],
})
export class CmsPageEditorComponent implements OnInit {
  form: FormGroup;
  pageId: string | null = null;
  loading = false;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private cmsService: CmsService,
    private snackBar: MatSnackBar,
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      slug: ['', Validators.required],
      body: ['', Validators.required],
      metaTitle: [''],
      metaDescription: [''],
      isPublished: [false],
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.pageId = id;
      this.loadPage(id);
    }

    this.form.get('title')!.valueChanges.subscribe(title => {
      if (!this.pageId) {
        const slug = (title || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        this.form.patchValue({ slug }, { emitEvent: false });
      }
    });
  }

  loadPage(id: string) {
    this.loading = true;
    this.cmsService.getPages().subscribe({
      next: (res) => {
        const pages = (res as any).data || [];
        const page = pages.find((p: any) => p._id === id);
        if (page) { this.form.patchValue(page); }
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const dto = this.form.value;
    const obs = this.pageId
      ? this.cmsService.updatePage(this.pageId, dto)
      : this.cmsService.createPage(dto);
    obs.subscribe({
      next: () => {
        this.snackBar.open('Page saved', 'OK', { duration: 2000 });
        this.router.navigate(['/cms/pages']);
      },
      error: () => { this.snackBar.open('Failed to save', 'OK', { duration: 2000 }); this.saving = false; }
    });
  }
}
