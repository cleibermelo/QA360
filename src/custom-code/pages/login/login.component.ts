import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Translator } from '../../shared/translator.service';

/** The part of the product name shown in the theme color. */
const HIGHLIGHT = 'Pulse';

/** Page shown without a session: a greeting in the middle. "Sign in" is in the top right corner. */
@Component({
	selector: 'app-login',
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
		.highlight {
			color: var(--theme-100);
		}
		/* Flex items ignore the line breaks of the template, so no gap appears inside the word. */
		h1 {
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
		}
		h1 span {
			white-space: pre-wrap;
		}
	`,
	template: `
		<h1>
			<span>{{ greeting.before }}</span>
			@if (greeting.highlight) {
				<span class="highlight">{{ greeting.highlight }}</span>
			}
			<span>{{ greeting.after }}</span>
		</h1>
	`
})
export class LoginComponent {
	/** The translated text split around the highlighted word; the word is optional, so any language works. */
	protected readonly greeting = (() => {
		const text = inject(Translator).t('Login_Welcome');
		const index = text.indexOf(HIGHLIGHT);
		return index === -1
			? { before: text, highlight: '', after: '' }
			: { before: text.slice(0, index), highlight: HIGHLIGHT, after: text.slice(index + HIGHLIGHT.length) };
	})();
}
