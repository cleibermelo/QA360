import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
	ActionTypeEnum,
	InputComponent,
	InputOptions,
	InputTypeEnum,
	ModalOptions,
	ModalService,
	PasswordInputComponent,
	PasswordInputOptions,
	SizeEnum
} from '@polygon/components';
import { HOME_PATH } from '../../auth/access';
import { SessionService } from '../../auth/session.service';
import { TranslatePipe } from '../../shared/translate.pipe';
import { Translator } from '../../shared/translator.service';

/** Opens the sign-in form in a modal. */
export const openLoginModal = (modal: ModalService, translator: Translator): void => {
	modal.toggleModal(
		new ModalOptions({
			id: 'qapulse-login',
			title: signal(translator.t('Login_Title')),
			size: signal(SizeEnum.Small),
			closeOnOutsideClick: signal(false),
			component: { componentClass: LoginFormComponent }
		})
	);
};

/** Body of the sign-in modal; the credentials are checked by Supabase Auth, never by the app. */
@Component({
	selector: 'app-login-form',
	imports: [InputComponent, PasswordInputComponent, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: block;
		}
		.hint {
			margin: 0 0 16px;
			color: var(--grey-8);
		}
		.field {
			display: flex;
			flex-direction: column;
			gap: 4px;
			margin-bottom: 16px;
		}
		.label {
			font-size: 12px;
			color: var(--grey-8);
		}
		.required::after {
			content: ' *';
			color: var(--error-100);
		}
	`,
	template: `
		<p class="hint">{{ 'Login_Subtitle' | translate }}</p>
		<div class="field">
			<span class="label required">{{ 'Login_Email' | translate }}</span>
			<po-input
				[(value)]="email"
				[options]="emailOptions"
				[ariaLabel]="'Login_Email' | translate"
				(keydown.enter)="submit()" />
		</div>
		<div class="field">
			<span class="label required">{{ 'Login_Password' | translate }}</span>
			<po-password-input
				[(value)]="password"
				[options]="passwordOptions"
				[ariaLabel]="'Login_Password' | translate"
				(keydown.enter)="submit()" />
		</div>
	`
})
export class LoginFormComponent implements OnInit {
	private readonly session = inject(SessionService);
	private readonly router = inject(Router);
	private readonly modal = inject(ModalService);
	private readonly translator = inject(Translator);

	protected readonly email = signal('');
	protected readonly password = signal('');
	private submitting = false;

	protected readonly emailOptions = new InputOptions({
		type: InputTypeEnum.Email,
		autocomplete: 'on',
		maxLength: 254
	});
	protected readonly passwordOptions = new PasswordInputOptions({ maxLength: 72 });

	ngOnInit(): void {
		this.modal.setActions([
			{
				type: ActionTypeEnum.Main,
				options: { text: this.translator.t('Login_Confirm'), onClick: () => void this.submit() }
			},
			{
				type: ActionTypeEnum.Secondary,
				options: { text: this.translator.t('Common_Cancel'), onClick: () => this.modal.toggleModal() }
			}
		]);
	}

	protected async submit(): Promise<void> {
		if (this.submitting) {
			return;
		}
		this.modal.clearErrors();
		const email = this.email().trim();
		const password = this.password();
		if (!email || !password) {
			this.modal.setErrors({ message: this.translator.t('Login_ErrorCredentials') });
			return;
		}
		this.submitting = true;
		const result = await this.session.signIn(email, password);
		// The password is not kept after the attempt.
		this.password.set('');
		this.submitting = false;
		if ('reason' in result) {
			const key = result.reason === 'credentials' ? 'Login_ErrorCredentials' : 'Login_ErrorUnavailable';
			this.modal.setErrors({ message: this.translator.t(key) });
			return;
		}
		this.modal.toggleModal();
		await this.router.navigateByUrl(HOME_PATH, { replaceUrl: true });
	}
}
