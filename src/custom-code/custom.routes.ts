import { Routes } from '@angular/router';

/** Routes of the app, all lazy-loaded; unknown paths and the root land on the dashboard. */
export const customRoutes: Routes = [
	{
		path: 'dashboard',
		loadComponent: () => import('./pages/dashboard/dashboard.component').then((c) => c.DashboardComponent)
	},
	{
		path: 'records',
		loadComponent: () => import('./pages/records/records-list.component').then((c) => c.RecordsListComponent)
	},
	{
		path: 'teams',
		loadComponent: () => import('./pages/teams/teams-list.component').then((c) => c.TeamsListComponent)
	},
	{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
	{ path: '**', redirectTo: 'dashboard' }
];
