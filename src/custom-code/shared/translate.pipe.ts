import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslationParams, Translator } from './translator.service';

/** Template access to `Translator.t`: `{{ 'Records_Save' | translate }}`. Pure, because texts do not change after load. */
@Pipe({ name: 'translate' })
export class TranslatePipe implements PipeTransform {
	private readonly translator = inject(Translator);

	transform(key: string, params?: TranslationParams): string {
		return this.translator.t(key, params);
	}
}
