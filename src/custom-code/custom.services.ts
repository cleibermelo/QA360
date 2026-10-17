import { effect, EnvironmentProviders, inject, provideEnvironmentInitializer, Provider } from '@angular/core';
import { I18nService, USER } from '@polygon/core';
import { CoverageRepository } from './data/coverage.repository';
import { CoverageStore } from './data/coverage.store';
import { SupabaseCoverageRepository } from './data/supabase-coverage.repository';
import { FeedbackService } from './shared/feedback.service';
import { Translator } from './shared/translator.service';

/** Where the chosen language is remembered between visits. */
const LANGUAGE_STORAGE_KEY = 'qa360.language';
const DEFAULT_CULTURE = 'en-US';

/**
 * Makes the language menu of the user area work without authentication.
 * The culture is set before Polygon loads the texts, and a language chosen in the menu is
 * remembered and the page reloaded, because screens read their texts once when they render.
 */
const provideLanguageSupport = (): EnvironmentProviders =>
	provideEnvironmentInitializer(() => {
		const user = inject(USER);
		const i18n = inject(I18nService);
		const startCulture = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? DEFAULT_CULTURE;

		// Polygon resets both values when the identity starts, so they are applied again after that.
		const apply = (): void => {
			user.idsCulture = DEFAULT_CULTURE; // the menu lists the other languages relative to this one
			user.culture = startCulture;
		};
		apply();
		user.refreshUserData$.subscribe(apply);

		i18n.currentLocale$.subscribe(() => {
			if (user.culture !== startCulture) {
				localStorage.setItem(LANGUAGE_STORAGE_KEY, user.culture);
				location.reload();
			}
		});
	});

/**
 * Polygon hard-codes images like "/assets/images/default-user-image.svg", which ignore the base href.
 * When the app is served from a sub-path (GitHub Pages: /QA360/) those images break, so their URL is rewritten.
 */
const provideSubpathAssetFix = (): EnvironmentProviders =>
	provideEnvironmentInitializer(() => {
		const base = new URL(document.baseURI);
		if (base.pathname === '/') {
			return;
		}
		const fix = (image: HTMLImageElement): void => {
			const src = image.getAttribute('src');
			if (src?.startsWith('/assets/')) {
				image.setAttribute('src', new URL(src.slice(1), base).href);
			}
		};
		new MutationObserver((records) => {
			for (const record of records) {
				if (record.target instanceof HTMLImageElement) {
					fix(record.target);
				}
				record.addedNodes.forEach((node) => {
					if (node instanceof HTMLImageElement) {
						fix(node);
					} else if (node instanceof HTMLElement) {
						node.querySelectorAll('img').forEach(fix);
					}
				});
			}
		}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
	});

/** Stores the data in Supabase and tells the user when it cannot be loaded. */
const provideCoverageData = (): (Provider | EnvironmentProviders)[] => [
	{ provide: CoverageRepository, useClass: SupabaseCoverageRepository },
	provideEnvironmentInitializer(() => {
		// Creating the store here starts the first load while the app is still starting.
		const store = inject(CoverageStore);
		const feedback = inject(FeedbackService);
		const translator = inject(Translator);
		effect(() => {
			const key = store.loadError();
			if (key) {
				feedback.error(translator.t(key));
			}
		});
	})
];

/**
 * If your application needs to register any service on application bootstrap
 * use this provider array to specify them.
 */
export const customMainServices: (Provider | EnvironmentProviders)[] = [
	provideLanguageSupport(),
	provideSubpathAssetFix(),
	...provideCoverageData()
];
