import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { SuperAdminGuard } from './core/guards/super-admin.guard';
import { LayoutComponent } from './shared/components/layout/layout.component';

const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then((m) => m.AuthModule),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.module').then(m => m.DashboardModule) },
      { path: 'clients', loadChildren: () => import('./features/clients/clients.module').then(m => m.ClientsModule) },
      { path: 'bookings', loadChildren: () => import('./features/bookings/bookings.module').then(m => m.BookingsModule) },
      { path: 'credit', loadChildren: () => import('./features/credit/credit.module').then(m => m.CreditModule) },
      { path: 'reports', loadChildren: () => import('./features/reports/reports.module').then(m => m.ReportsModule) },
      { path: 'cms', loadChildren: () => import('./features/cms/cms.module').then(m => m.CmsModule) },
      { path: 'sub-admins', loadChildren: () => import('./features/sub-admins/sub-admins.module').then(m => m.SubAdminsModule) },
      { path: 'api-settings', canActivate: [SuperAdminGuard], loadChildren: () => import('./features/api-settings/api-settings.module').then(m => m.ApiSettingsModule) },
      { path: 'loyalty', loadChildren: () => import('./features/loyalty/loyalty.module').then(m => m.LoyaltyModule) },
      { path: 'support', loadChildren: () => import('./features/support/support.module').then(m => m.SupportModule) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
