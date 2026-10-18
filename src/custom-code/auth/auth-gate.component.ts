import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { LoaderComponent, LoadingStateEnum } from '@polygon/components';
import { filter, map } from 'rxjs';
import { areaOfPath, resolveAccess } from './access';
import { SessionService } from './session.service';

/**
 * Parent of every screen: shows the loader while the session is unknown, sends the user to the right
 * screen, and only creates the screen once access is allowed, so protected content never flashes.
 */
@Component({
	selector: 'app-auth-gate',
	imports: [RouterOutlet, LoaderComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		.loading {
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 240px;
		}
	`,
	template: `
		@switch (decision().kind) {
			@case ('wait') {
				<div class="loading"><po-loader [state]="loadingState" /></div>
			}
			@case ('allow') {
				<router-outlet />
			}
		}
	`
})
export class AuthGateComponent {
	private readonly session = inject(SessionService);
	private readonly router = inject(Router);

	protected readonly loadingState = LoadingStateEnum.Loading;

	private readonly url = toSignal(
		this.router.events.pipe(
			filter((event): event is NavigationEnd => event instanceof NavigationEnd),
			map((event) => event.urlAfterRedirects)
		),
		// The gate is created while the first navigation is still running, so its target is not in `router.url` yet.
		{
			initialValue: this.router.serializeUrl(
				this.router.getCurrentNavigation()?.finalUrl ?? this.router.parseUrl(this.router.url)
			)
		}
	);

	protected readonly decision = computed(() =>
		resolveAccess(
			{
				loading: this.session.loading(),
				signedIn: this.session.signedIn(),
				passwordPending: this.session.passwordPending()
			},
			areaOfPath(this.url())
		)
	);

	constructor() {
		effect(() => {
			const decision = this.decision();
			if (decision.kind === 'redirect') {
				untracked(() => void this.router.navigateByUrl(decision.to, { replaceUrl: true }));
			}
		});
	}
}
