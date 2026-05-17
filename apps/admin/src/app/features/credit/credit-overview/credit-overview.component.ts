import { Component, OnInit, signal } from '@angular/core';
import { ClientsService } from '../../../core/services/clients.service';

export interface OutstandingEntry {
  companyId: string;
  companyName: string;
  outstandingBalance: number;
  currency: string;
  agingBucket: '0-30' | '31-60' | '61-90' | '90+';
  lastBookingDate?: string;
}

@Component({
  standalone: false,
  selector: 'app-credit-overview',
  templateUrl: './credit-overview.component.html',
  styleUrls: ['./credit-overview.component.scss'],
})
export class CreditOverviewComponent implements OnInit {
  loading = signal(true);
  entries = signal<OutstandingEntry[]>([]);
  error = signal('');

  displayedColumns = ['companyName', 'outstandingBalance', 'agingBucket', 'lastBookingDate'];

  get bucket030(): OutstandingEntry[] {
    return this.entries().filter((e) => e.agingBucket === '0-30');
  }
  get bucket3160(): OutstandingEntry[] {
    return this.entries().filter((e) => e.agingBucket === '31-60');
  }
  get bucket6190(): OutstandingEntry[] {
    return this.entries().filter((e) => e.agingBucket === '61-90');
  }
  get bucketOver90(): OutstandingEntry[] {
    return this.entries().filter((e) => e.agingBucket === '90+');
  }

  get totalOutstanding(): number {
    return this.entries().reduce((sum, e) => sum + e.outstandingBalance, 0);
  }

  constructor(private clientsService: ClientsService) {}

  ngOnInit() {
    this.loadOutstanding();
  }

  loadOutstanding() {
    this.loading.set(true);
    this.error.set('');
    this.clientsService.getOutstanding().subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? [];
        this.entries.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load outstanding accounts.');
        this.loading.set(false);
      },
    });
  }

  formatAmount(fils: number): string {
    return (fils / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getBucketClass(bucket: string): string {
    const map: Record<string, string> = {
      '0-30': 'bucket-green',
      '31-60': 'bucket-yellow',
      '61-90': 'bucket-orange',
      '90+': 'bucket-red',
    };
    return map[bucket] || '';
  }
}
