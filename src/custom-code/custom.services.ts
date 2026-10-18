import {
	effect,
	EnvironmentProviders,
	inject,
	Injector,
	provideEnvironmentInitializer,
	Provider,
	untracked
} from '@angular/core';
import { I18nService, USER } from '@polygon/core';
import { provideUserAreaIdentity } from './auth/polygon-user-area';
import { SessionService } from './auth/session.service';
import { provideSignedOutChrome } from './auth/signed-out-chrome';
import { CoverageRepository } from './data/coverage.repository';
import { CoverageStore } from './data/coverage.store';
import { SupabaseCoverageRepository } from './data/supabase-coverage.repository';
import { saveDashboardFiltersForReload } from './shared/dashboard-filters-memory';
import { FeedbackService } from './shared/feedback.service';
import { Translator } from './shared/translator.service';

/** Where the chosen language is remembered between visits. */
const LANGUAGE_STORAGE_KEY = 'qapulse.language';
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
				saveDashboardFiltersForReload();
				location.reload();
			}
		});
	});

/**
 * Polygon hard-codes images like "/assets/images/default-user-image.svg", which ignore the base href.
 * When the app is served from a sub-path (GitHub Pages: /QAPulse/) those images break, so their URL is rewritten.
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

/** Stores the data in Supabase, loads it once the user is signed in, and tells the user when it cannot be loaded. */
const provideCoverageData = (): (Provider | EnvironmentProviders)[] => [
	{ provide: CoverageRepository, useClass: SupabaseCoverageRepository },
	provideEnvironmentInitializer(() => {
		const session = inject(SessionService);
		const injector = inject(Injector);
		const feedback = inject(FeedbackService);
		const translator = inject(Translator);
		let started = false;
		// Creating the store starts its first load, so it must not exist before there is a session.
		effect(() => {
			if (!session.userId()) {
				return;
			}
			untracked(() => {
				const store = injector.get(CoverageStore);
				if (started) {
					void store.reload();
				}
				started = true;
			});
		});
		effect(() => {
			if (!session.userId()) {
				return;
			}
			const key = untracked(() => injector.get(CoverageStore)).loadError();
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
	provideUserAreaIdentity(),
	provideSignedOutChrome(),
	...provideCoverageData()
];
