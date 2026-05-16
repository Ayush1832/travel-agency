import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReportsService } from '../../../core/services/reports.service';
import { CreditReport } from '../../../core/models/report.models';

@Component({
  standalone: false,
  selector: 'app-credit-report',
  templateUrl: './credit-report.component.html',
  styleUrls: ['./credit-report.component.scss'],
})
export class CreditReportComponent implements OnInit {
  fromDate = '';
  toDate = '';
  report: CreditReport | null = null;
  loading = false;
  displayedColumns = ['date', 'topUps', 'creditUsed', 'settlements'];

  constructor(
    private reportsService: ReportsService,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    const now = new Date();
    this.toDate = now.toISOString().split('T')[0];
    this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const q = this.route.snapshot.queryParams;
    if (q['from']) this.fromDate = q['from'];
    if (q['to']) this.toDate = q['to'];
    this.loadReport();
  }

  loadReport() {
    this.loading = true;
    this.reportsService.getCredit(this.fromDate, this.toDate).subscribe({
      next: (res) => { this.report = (res as any).data; this.loading = false; },
      error: () => { this.snackBar.open('Failed to load report', 'OK', { duration: 3000 }); this.loading = false; }
    });
  }

  formatAed(fils: number): string {
    if (!fils) return '0.00';
    return (fils / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
