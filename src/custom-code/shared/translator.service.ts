import { inject, Injectable } from '@angular/core';
import { I18nService } from '@polygon/core';

export type TranslationParams = Record<string, string | number>;

/**
 * Looks up UI texts in the Polygon i18n files (assets/i18n/<culture>/clientApp.components.lang.json).
 * Resources are loaded for the user's culture before the app starts, so lookups are synchronous.
 */
@Injectable({ providedIn: 'root' })
export class Translator {
	private readonly i18n = inject(I18nService);

	/** Returns the text for `key` (without the `RES_` prefix), replacing `{name}` placeholders with `params`. */
	t(key: string, params?: TranslationParams): string {
		const text = this.i18n.get(`clientApp.components.RES_${key}`);
		return params ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? '')) : text;
	}

	/** Test types are data, so their labels follow the pattern TestType_<key>_Name and TestType_<key>_Unit. */
	testTypeName(key: string): string {
		return this.t(`TestType_${key}_Name`);
	}

	testTypeUnit(key: string): string {
		return this.t(`TestType_${key}_Unit`);
	}

	/** Locale of the user, e.g. "en-US". */
	get locale(): string {
		return this.i18n.currentLocale$.value ?? 'en-US';
	}

	/** Short month name in the user's language without the final dot ("jan", "out", "Oct"). */
	monthShort(month: number): string {
		return new Date(2000, month - 1, 1).toLocaleString(this.locale, { month: 'short' }).replace(/\.$/, '');
	}

	/** Full month name in the user's language, capitalized ("January", "Janeiro"). */
	monthName(month: number): string {
		const name = new Date(2000, month - 1, 1).toLocaleString(this.locale, { month: 'long' });
		return name.charAt(0).toLocaleUpperCase(this.locale) + name.slice(1);
	}
}
