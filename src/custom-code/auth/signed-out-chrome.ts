import {
	ApplicationRef,
	ChangeDetectionStrategy,
	Component,
	computed,
	createComponent,
	EnvironmentInjector,
	inject,
	provideEnvironmentInitializer,
	EnvironmentProviders,
	effect
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ButtonComponent, ButtonOptions, ButtonTypeEnum, ModalService, SizeEnum } from '@polygon/components';
import { filter, take } from 'rxjs';
import { openLoginModal } from '../pages/login/login-form.component';
import { Translator } from '../shared/translator.service';
import { SessionService } from './session.service';

/** "Sign in" at the top right of the page, where the user area is while someone is signed in. */
@Component({
	selector: 'app-sign-in-button',
	imports: [ButtonComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			position: fixed;
			top: 32px;
			right: 16px;
			transform: translateY(-50%);
			z-index: 1100;
		}
	`,
	template: `
		@if (visible()) {
			<po-button [options]="options" (action)="open()" />
		}
	`
})
export class SignInButtonComponent {
	private readonly session = inject(SessionService);
	private readonly modal = inject(ModalService);
	private readonly translator = inject(Translator);

	protected readonly visible = computed(() => !this.session.loading() && !this.session.signedIn());
	protected readonly options = new ButtonOptions({
		text: this.translator.t('Login_Submit'),
		type: ButtonTypeEnum.Primary,
		size: SizeEnum.Small
	});

	protected open(): void {
		openLoginModal(this.modal, this.translator);
	}
}

/**
 * Without a session the shell shows only the product name and the "Sign in" button: body classes hide the menu,
 * its button, the menu search and the user area (rules in styles/loader.scss), because the shell cannot do that
 * after it has started.
 */
export const provideSignedOutChrome = (): EnvironmentProviders =>
	provideEnvironmentInitializer(() => {
		const session = inject(SessionService);
		const injector = inject(EnvironmentInjector);
		const applicationRef = inject(ApplicationRef);
		// After the first navigation the shell is rendered, so the translations are loaded when the button reads its text.
		inject(Router)
			.events.pipe(
				filter((event) => event instanceof NavigationEnd),
				take(1)
			)
			.subscribe(() => {
				const button = createComponent(SignInButtonComponent, { environmentInjector: injector });
				applicationRef.attachView(button.hostView);
				document.body.appendChild(button.location.nativeElement);
			});

		effect(() => {
			const signedIn = session.signedIn();
			document.body.classList.toggle('qa360-auth-anonymous', !signedIn);
			document.body.classList.toggle('qa360-auth-locked', !signedIn || session.passwordPending());
		});
	});
