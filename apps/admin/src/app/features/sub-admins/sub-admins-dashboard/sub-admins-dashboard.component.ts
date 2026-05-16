import { Component, OnInit, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SubAdminService } from '../../../core/services/sub-admin.service';
import { Role, SubAdmin, Permission } from '../../../core/models/admin.models';

const MODULES = ['bookings', 'credit', 'clients', 'cms', 'reports', 'api_settings', 'sub_admin', 'support'];
const ACTIONS = ['view', 'create', 'edit', 'delete'];

@Component({
  standalone: false,
  selector: 'app-role-form-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.role ? 'Edit Role' : 'New Role' }}</h2>
    <mat-dialog-content style="min-width:500px">
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role Name</mat-label>
          <input matInput formControlName="name">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width" style="margin-bottom:16px">
          <mat-label>Description</mat-label>
          <input matInput formControlName="description">
        </mat-form-field>
      </form>
      <div class="permissions-table">
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th *ngFor="let a of actions">{{ a }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let mod of modules">
              <td class="module-name">{{ mod }}</td>
              <td *ngFor="let action of actions">
                <mat-checkbox [(ngModel)]="perms[mod][action]" color="primary"></mat-checkbox>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.permissions-table table { width: 100%; border-collapse: collapse; } .permissions-table th, .permissions-table td { padding: 8px 12px; text-align: center; border-bottom: 1px solid #eee; } .module-name { text-align: left; font-weight: 500; text-transform: capitalize; }`]
})
export class RoleFormDialog implements OnInit {
  form: FormGroup;
  modules = MODULES;
  actions = ACTIONS;
  perms: Record<string, Record<string, boolean>> = {};

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<RoleFormDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { role?: Role }
  ) {
    this.form = this.fb.group({
      name: [data.role?.name || '', Validators.required],
      description: [data.role?.description || ''],
    });
    MODULES.forEach(m => {
      const existing = data.role?.permissions?.find(p => p.module === m);
      this.perms[m] = { view: existing?.view || false, create: existing?.create || false, edit: existing?.edit || false, delete: existing?.delete || false };
    });
  }

  ngOnInit() {}

  save() {
    if (this.form.invalid) return;
    const permissions: Permission[] = MODULES.map(m => ({
      module: m, view: this.perms[m]['view'], create: this.perms[m]['create'],
      edit: this.perms[m]['edit'], delete: this.perms[m]['delete']
    }));
    this.dialogRef.close({ ...this.form.value, permissions });
  }
}

@Component({
  standalone: false,
  selector: 'app-sub-admin-form-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.subAdmin ? 'Edit Sub-Admin' : 'New Sub-Admin' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>First Name</mat-label><input matInput formControlName="firstName">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Last Name</mat-label><input matInput formControlName="lastName">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-col">
          <mat-label>Email</mat-label><input matInput formControlName="email" type="email">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-col" *ngIf="!data.subAdmin">
          <mat-label>Password</mat-label><input matInput formControlName="password" type="password">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-col">
          <mat-label>Role</mat-label>
          <mat-select formControlName="roleId">
            <mat-option *ngFor="let r of data.roles" [value]="r._id">{{ r.name }}</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; min-width: 400px; } .full-col { grid-column: 1 / -1; }`]
})
export class SubAdminFormDialog {
  form: FormGroup;
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<SubAdminFormDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { subAdmin?: SubAdmin; roles: Role[] }
  ) {
    const s = data.subAdmin;
    this.form = this.fb.group({
      firstName: [s?.firstName || '', Validators.required],
      lastName: [s?.lastName || '', Validators.required],
      email: [s?.email || '', [Validators.required, Validators.email]],
      password: [s ? undefined : '', s ? [] : [Validators.required, Validators.minLength(8)]],
      roleId: [s?.roleId || '', Validators.required],
    });
  }
  save() { if (this.form.valid) this.dialogRef.close(this.form.value); }
}

@Component({
  standalone: false,
  selector: 'app-sub-admins-dashboard',
  templateUrl: './sub-admins-dashboard.component.html',
  styleUrls: ['./sub-admins-dashboard.component.scss'],
})
export class SubAdminsDashboardComponent implements OnInit {
  roles: Role[] = [];
  subAdmins: SubAdmin[] = [];
  rolesLoading = false;
  adminsLoading = false;

  roleColumns = ['name', 'description', 'permissions', 'actions'];
  adminColumns = ['name', 'email', 'role', 'status', 'actions'];

  constructor(
    private subAdminService: SubAdminService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() { this.loadRoles(); this.loadSubAdmins(); }

  loadRoles() {
    this.rolesLoading = true;
    this.subAdminService.listRoles().subscribe({
      next: (res) => { this.roles = (res as any).data || []; this.rolesLoading = false; },
      error: () => { this.rolesLoading = false; }
    });
  }

  loadSubAdmins() {
    this.adminsLoading = true;
    this.subAdminService.listSubAdmins().subscribe({
      next: (res) => { this.subAdmins = (res as any).data || []; this.adminsLoading = false; },
      error: () => { this.adminsLoading = false; }
    });
  }

  openRoleForm(role?: Role) {
    const ref = this.dialog.open(RoleFormDialog, { width: '600px', data: { role } });
    ref.afterClosed().subscribe(dto => {
      if (dto) {
        const obs = role ? this.subAdminService.updateRole(role._id, dto) : this.subAdminService.createRole(dto);
        obs.subscribe({
          next: () => { this.snackBar.open('Role saved', 'OK', { duration: 2000 }); this.loadRoles(); },
          error: () => this.snackBar.open('Failed', 'OK', { duration: 2000 })
        });
      }
    });
  }

  deleteRole(id: string) {
    this.subAdminService.deleteRole(id).subscribe({
      next: () => { this.snackBar.open('Role deleted', 'OK', { duration: 2000 }); this.loadRoles(); },
      error: () => this.snackBar.open('Failed', 'OK', { duration: 2000 })
    });
  }

  openSubAdminForm(subAdmin?: SubAdmin) {
    const ref = this.dialog.open(SubAdminFormDialog, { width: '480px', data: { subAdmin, roles: this.roles } });
    ref.afterClosed().subscribe(dto => {
      if (dto) {
        const obs = subAdmin ? this.subAdminService.updateSubAdmin(subAdmin._id, dto) : this.subAdminService.createSubAdmin(dto);
        obs.subscribe({
          next: () => { this.snackBar.open('Saved', 'OK', { duration: 2000 }); this.loadSubAdmins(); },
          error: () => this.snackBar.open('Failed', 'OK', { duration: 2000 })
        });
      }
    });
  }

  disableSubAdmin(id: string) {
    this.subAdminService.disableSubAdmin(id).subscribe({
      next: () => { this.snackBar.open('Sub-admin disabled', 'OK', { duration: 2000 }); this.loadSubAdmins(); },
      error: () => this.snackBar.open('Failed', 'OK', { duration: 2000 })
    });
  }

  permSummary(permissions: Permission[]): string {
    return permissions?.filter(p => p.view).map(p => p.module).join(', ') || 'No permissions';
  }

  getRoleName(roleId: string): string {
    return this.roles.find(r => r._id === roleId)?.name || roleId;
  }
}
