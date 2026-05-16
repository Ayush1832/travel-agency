import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { AppNotification } from '../../../core/models/notification.models';

@Component({
  standalone: false,
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit {
  currentUser = this.authService.currentUser;
  unreadCount = this.notificationsService.unreadCount;
  recentNotifications: AppNotification[] = [];

  constructor(
    private authService: AuthService,
    private notificationsService: NotificationsService,
  ) {}

  ngOnInit() {
    this.notificationsService.startPolling();
    this.loadRecentNotifications();
  }

  loadRecentNotifications() {
    this.notificationsService.getAll({ limit: 5 }).subscribe({
      next: (res) => (this.recentNotifications = res.data),
      error: () => {},
    });
  }

  markAllRead() {
    this.notificationsService.markAllRead().subscribe({
      next: () => {
        this.notificationsService.unreadCount.set(0);
        this.recentNotifications = this.recentNotifications.map((n) => ({ ...n, isRead: true }));
      },
      error: () => {},
    });
  }

  logout() {
    this.authService.logout().subscribe();
  }
}
