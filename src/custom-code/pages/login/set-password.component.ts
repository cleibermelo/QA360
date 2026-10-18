import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
	ButtonComponent,
	ButtonOptions,
	ButtonTypeEnum,
	InlineMessageComponent,
	InlineMessageOptions,
	PasswordInputComponent,
	PasswordInputOptions,
	StatusEnum
} from '@polygon/components';
import { EnvironmentSettings } from '@polygon/core';
import { HOME_PATH } from '../../auth/access';
import { validateNewPassword } from '../../auth/password-rules';
import { SessionService } from '../../auth/session.service';
import { readSupabaseEnvironment } from '../../auth/supabase.client';
import { TranslatePipe } from '../../shared/translate.pipe';
import { Translator } from '../../shared/translator.service';

/** First access through the invite link: the session exists, but the account still needs a password. */
@Component({
	selector: 'app-set-password',
	imports: [PasswordInputComponent, ButtonComponent, InlineMessageComponent, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrl: '../auth-form.scss',
	template: `
		<section class="auth-card">
			<h3>{{ 'SetPassword_Title' | translate }}</h3>
			<p class="hint">{{ 'SetPassword_Hint' | translate: { count: minLength } }}</p>
			@if (errorMessage(); as message) {
				<po-inline-message class="message" [options]="message" />
			}
			<div class="field">
				<span class="label required">{{ 'SetPassword_New' | translate }}</span>
				<po-password-input
					[(value)]="password"
					[options]="passwordOptions"
					[ariaLabel]="'SetPassword_New' | translate" />
			</div>
			<div class="field">
				<span class="label required">{{ 'SetPassword_Confirm' | translate }}</span>
				<po-password-input
					[(value)]="confirmation"
					[options]="passwordOptions"
					[ariaLabel]="'SetPassword_Confirm' | translate"
					(keydown.enter)="submit()" />
			</div>
			<po-button class="submit" [options]="submitOptions" [disabled]="submitting()" (action)="submit()" />
		</section>
	`
})
export class SetPasswordComponent {
	private readonly session = inject(SessionService);
	private readonly router = inject(Router);
	private readonly translator = inject(Translator);

	protected readonly minLength = readSupabaseEnvironment(inject(EnvironmentSettings)).passwordMinLength as number;
	protected readonly password = signal('');
	protected readonly confirmation = signal('');
	protected readonly submitting = signal(false);
	private readonly errorKey = signal<string | null>(null);

	protected readonly passwordOptions = new PasswordInputOptions({ maxLength: 72 });
	protected readonly submitOptions = new ButtonOptions({
		text: this.translator.t('SetPassword_Submit'),
		type: ButtonTypeEnum.Primary
	});

	protected readonly errorMessage = computed(() => {
		const key = this.errorKey();
		return key
			? new InlineMessageOptions({
					type: StatusEnum.Error,
					message: this.translator.t(key, { count: this.minLength })
				})
			: null;
	});

	protected async submit(): Promise<void> {
		if (this.submitting()) {
			return;
		}
		const invalid = validateNewPassword(this.password(), this.confirmation(), this.minLength);
		if (invalid) {
			this.errorKey.set(invalid);
			return;
		}
		this.submitting.set(true);
		this.errorKey.set(null);
		const result = await this.session.setPassword(this.password());
		// The passwords are not kept after the attempt.
		this.password.set('');
		this.confirmation.set('');
		this.submitting.set(false);
		if ('reason' in result) {
			this.errorKey.set(
				{
					weak: 'SetPassword_ErrorTooShort',
					unavailable: 'Login_ErrorUnavailable',
					generic: 'SetPassword_ErrorGeneric'
				}[result.reason]
			);
			return;
		}
		await this.router.navigateByUrl(HOME_PATH, { replaceUrl: true });
	}
}
