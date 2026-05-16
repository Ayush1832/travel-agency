import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ClientsService } from '../../../core/services/clients.service';
import { Company } from '../../../core/models/company.models';
import { ConfirmActionDialog } from '../dialogs/confirm-action.dialog';

@Component({
  standalone: false,
  selector: 'app-clients-list',
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  tabs = [
    { label: 'All', status: '' },
    { label: 'Pending', status: 'pending' },
    { label: 'Active', status: 'active' },
    { label: 'Suspended', status: 'suspended' },
    { label: 'Rejected', status: 'rejected' },
  ];

  selectedTab = 0;
  searchControl = new FormControl('');

  clients: Company[] = [];
  total = 0;
  page = 0;
  limit = 20;
  loading = false;

  displayedColumns = ['companyName', 'contactPerson', 'email', 'status', 'creditLimit', 'createdAt', 'actions'];

  constructor(
    private clientsService: ClientsService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadClients();
    this.searchControl.valueChanges.pipe(debounceTime(400), distinctUntilChanged()).subscribe(() => {
      this.page = 0;
      this.loadClients();
    });
  }

  get currentStatus(): string {
    return this.tabs[this.selectedTab]?.status || '';
  }

  loadClients() {
    this.loading = true;
    this.clientsService.list({
      status: this.currentStatus || undefined,
      search: this.searchControl.value || undefined,
      page: this.page + 1,
      limit: this.limit,
    }).subscribe({
      next: (res) => {
        this.clients = res.data.data;
        this.total = res.data.total;
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load clients', 'OK', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onTabChange(index: number) {
    this.selectedTab = index;
    this.page = 0;
    this.loadClients();
  }

  onPage(event: PageEvent) {
    this.page = event.pageIndex;
    this.limit = event.pageSize;
    this.loadClients();
  }

  viewClient(id: string) {
    this.router.navigate(['/clients', id]);
  }

  approve(client: Company) {
    this.clientsService.approve(client._id).subscribe({
      next: () => {
        this.snackBar.open('Client approved', 'OK', { duration: 3000 });
        this.loadClients();
      },
      error: () => this.snackBar.open('Failed to approve', 'OK', { duration: 3000 })
    });
  }

  openSuspend(client: Company) {
    const ref = this.dialog.open(ConfirmActionDialog, {
      width: '400px',
      data: {
        title: 'Suspend Client',
        message: `Suspend ${client.companyName}?`,
        requireReason: true,
        reasonLabel: 'Suspension reason',
        confirmLabel: 'Suspend',
        confirmColor: 'warn',
      }
    });
    ref.afterClosed().subscribe(reason => {
      if (reason) {
        this.clientsService.suspend(client._id, reason).subscribe({
          next: () => {
            this.snackBar.open('Client suspended', 'OK', { duration: 3000 });
            this.loadClients();
          },
          error: () => this.snackBar.open('Failed to suspend', 'OK', { duration: 3000 })
        });
      }
    });
  }

  formatAed(fils: number): string {
    return (fils / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      active: 'chip-active', pending: 'chip-pending',
      suspended: 'chip-suspended', rejected: 'chip-rejected'
    };
    return map[status] || '';
  }
}
