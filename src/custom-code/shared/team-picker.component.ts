import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SingleSelectComponent } from '@polygon/components';
import { CoverageStore } from '../data/coverage.store';
import { TranslatePipe } from './translate.pipe';

/** Team select shared by the screens; the choice lives in the store so it follows the user between screens. */
@Component({
	selector: 'app-team-picker',
	imports: [SingleSelectComponent, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		.field {
			display: flex;
			flex-direction: column;
			gap: 4px;
			min-width: 220px;
		}
		.label {
			font-size: 12px;
			color: var(--grey-8);
		}
		@media (max-width: 600px) {
			:host {
				display: block;
			}
			.field {
				min-width: 0;
			}
		}
	`,
	template: `
		<div class="field">
			<span class="label">{{ 'Common_Team' | translate }}</span>
			<po-single-select
				[defaultData]="{ data: store.teams() }"
				valueKey="id"
				labelKey="name"
				[placeholder]="'TeamPicker_Placeholder' | translate"
				[ariaLabel]="'Common_Team' | translate"
				[selectedValue]="store.selectedTeamId()"
				(selectedValueChange)="store.selectTeam($any($event))" />
		</div>
	`
})
export class TeamPickerComponent {
	protected readonly store = inject(CoverageStore);
}
