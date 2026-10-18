import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../shared/translate.pipe';

/** Page shown without a session: a greeting in the middle. "Sign in" is in the top right corner. */
@Component({
	selector: 'app-login',
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: flex;
			align-items: center;
			justify-content: center;
			flex: 1;
			min-height: 60vh;
			padding: 24px;
			text-align: center;
		}
		h1 {
			margin: 0;
			color: var(--grey-9);
			font-size: 32px;
			font-weight: 500;
		}
	`,
	template: `<h1>{{ 'Login_Welcome' | translate }}</h1>`
})
export class LoginComponent {}
