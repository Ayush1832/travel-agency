import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { GuestGuard } from './core/guards/guest.guard';
import { LayoutComponent } from './shared/components/layout/layout.component';

const routes: Routes = [
  {
    path: 'auth',
    canActivate: [GuestGuard],
    loadChildren: () =>
      import('./features/auth/auth.module').then((m) => m.AuthModule),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.module').then((m) => m.DashboardModule),
      },
      {
        path: 'hotels',
        loadChildren: () =>
          import('./features/hotels/hotels.module').then((m) => m.HotelsModule),
      },
      {
        path: 'bookings',
        loadChildren: () =>
          import('./features/bookings/bookings.module').then((m) => m.BookingsModule),
      },
      {
        path: 'wallet',
        loadChildren: () =>
          import('./features/wallet/wallet.module').then((m) => m.WalletModule),
      },
      {
        path: 'support',
        loadChildren: () =>
          import('./features/support/support.module').then((m) => m.SupportModule),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
