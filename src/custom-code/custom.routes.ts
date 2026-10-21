import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthGateComponent } from './auth/auth-gate.component';
import { Translator } from './shared/translator.service';

/**
 * Routes of the app, all lazy-loaded; unknown paths and the root land on the dashboard.
 * The gate wraps all of them: it decides, from the session, which screens can be shown.
 */
export const customRoutes: Routes = [
	{
		path: '',
		component: AuthGateComponent,
		children: [
			{
				path: 'login',
				loadComponent: () => import('./pages/login/login.component').then((c) => c.LoginComponent)
			},
			{
				path: 'set-password',
				loadComponent: () => import('./pages/login/set-password.component').then((c) => c.SetPasswordComponent)
			},
			{
				path: 'logout',
				loadComponent: () => import('./pages/logout/logout.component').then((c) => c.LogoutComponent)
			},
			{
				path: 'dashboard',
				loadComponent: () => import('./pages/dashboard/dashboard.component').then((c) => c.DashboardComponent)
			},
			{
				path: 'records',
				loadComponent: () =>
					import('./pages/records/records-list.component').then((c) => c.RecordsListComponent)
			},
			{
				path: 'teams',
				loadComponent: () => import('./pages/teams/teams-list.component').then((c) => c.TeamsListComponent)
			},
			{
				path: 'sonarcloud',
				// The shell reads the title of the route when the navigation ends, so it is set here too.
				title: () => inject(Translator).t('Title_SonarCloud'),
				loadComponent: () =>
					import('./pages/sonarcloud/sonarcloud.component').then((c) => c.SonarcloudComponent)
			},
			{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
			{ path: '**', redirectTo: 'dashboard' }
		]
	}
];
