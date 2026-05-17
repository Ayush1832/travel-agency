import { Component } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  standalone: false,
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent {
  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard_customize', route: '/dashboard' },
    { label: 'Clients', icon: 'people', route: '/clients' },
    { label: 'Bookings', icon: 'book_online', route: '/bookings' },
    { label: 'Credit & Wallet', icon: 'account_balance', route: '/credit' },
    { label: 'Reports', icon: 'bar_chart', route: '/reports' },
    { label: 'CMS', icon: 'web', route: '/cms' },
    { label: 'Sub-Admins', icon: 'admin_panel_settings', route: '/sub-admins' },
    { label: 'API Settings', icon: 'settings', route: '/api-settings' },
    { label: 'Loyalty', icon: 'stars', route: '/loyalty' },
    { label: 'Support', icon: 'support_agent', route: '/support' },
  ];

  user: any;

  constructor(private authService: AuthService) {
    this.user = this.authService.currentUser;
  }

  logout() {
    this.authService.logout().subscribe();
  }
}
