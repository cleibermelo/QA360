import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoaderComponent, LoadingStateEnum } from '@polygon/components';
import { LOGIN_PATH } from '../../auth/access';
import { SessionService } from '../../auth/session.service';

/** Target of the "Sign out" menu item: ends the session and goes back to the login screen. */
@Component({
	selector: 'app-logout',
	imports: [LoaderComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<po-loader [state]="loadingState" />`
})
export class LogoutComponent implements OnInit {
	private readonly session = inject(SessionService);
	private readonly router = inject(Router);

	protected readonly loadingState = LoadingStateEnum.Loading;

	async ngOnInit(): Promise<void> {
		await this.session.signOut();
		await this.router.navigateByUrl(LOGIN_PATH, { replaceUrl: true });
	}
}
