import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import {
	ActionTypeEnum,
	InputComponent,
	InputOptions,
	ModalOptions,
	ModalService,
	NumericInputComponent,
	SizeEnum
} from '@polygon/components';
import { CoverageStore } from '../../data/coverage.store';
import { CoverageEntry, CoverageInput, formatPeriod } from '../../domain/models';
import { FeedbackService } from '../../shared/feedback.service';
import { TranslatePipe } from '../../shared/translate.pipe';
import { Translator } from '../../shared/translator.service';
import { RecordBatchFormComponent } from './record-batch-form.component';

/**
 * Opens the record modal. Without `entry` it is the table to enter a whole month;
 * with one, it edits that record (only value and note can change).
 */
export const openRecordModal = (modal: ModalService, translator: Translator, entry?: CoverageEntry): void => {
	modal.toggleModal(
		new ModalOptions({
			id: 'qapulse-record-form',
			title: signal(translator.t(entry ? 'Records_TitleEdit' : 'Records_Create')),
			size: signal(SizeEnum.Large),
			closeOnOutsideClick: signal(false),
			component: entry
				? { componentClass: RecordFormComponent, inputs: { entry } }
				: { componentClass: RecordBatchFormComponent }
		})
	);
};

/** Body of the edit modal: the record is shown as text, and the percentage and note can be changed. */
@Component({
	selector: 'app-record-form',
	imports: [NumericInputComponent, InputComponent, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: block;
		}
		.grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 16px;
		}
		.field {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.label {
			font-size: 12px;
			color: var(--grey-8);
		}
		.required::after {
			content: ' *';
			color: var(--error-100);
		}
		.value {
			padding: 6px 0;
			color: var(--grey-9);
		}
		@media (max-width: 600px) {
			.grid {
				grid-template-columns: minmax(0, 1fr);
			}
		}
	`,
	template: `
		<div class="grid">
			<div class="field">
				<span class="label">{{ 'Common_Team' | translate }}</span>
				<span class="value">{{ teamName() }}</span>
			</div>
			<div class="field">
				<span class="label">{{ 'Records_Period' | translate }}</span>
				<span class="value">{{ period() }}</span>
			</div>
			<div class="field">
				<span class="label">{{ 'Common_Application' | translate }}</span>
				<span class="value">{{ applicationName() }}</span>
			</div>
			<div class="field">
				<span class="label">{{ 'Common_TestType' | translate }}</span>
				<span class="value">{{ typeName() }}</span>
			</div>
			<div class="field">
				<span class="label required">
					{{ 'Records_PercentWithUnit' | translate: { unit: unit() } }}
				</span>
				<po-numeric-input
					[options]="percentOptions"
					[value]="percent()"
					(valueChange)="percent.set($event)"
					[ariaLabel]="'Records_Percent' | translate" />
			</div>
			<div class="field">
				<span class="label">{{ 'Records_NoteOptional' | translate }}</span>
				<po-input [(value)]="note" [options]="noteOptions" [ariaLabel]="'Records_Note' | translate" />
			</div>
		</div>
	`
})
export class RecordFormComponent implements OnInit {
	/** Set by the modal. */
	readonly entry = input.required<CoverageEntry>();

	private readonly store = inject(CoverageStore);
	private readonly modal = inject(ModalService);
	private readonly feedback = inject(FeedbackService);
	private readonly translator = inject(Translator);

	protected readonly percent = signal<number | null>(null);
	protected readonly note = signal('');

	protected readonly teamName = computed(() => this.store.getTeam(this.entry().teamId)?.name ?? '');
	protected readonly applicationName = computed(
		() =>
			this.store.getTeam(this.entry().teamId)?.applications.find((a) => a.id === this.entry().applicationId)
				?.name ?? this.entry().applicationId
	);
	protected readonly typeName = computed(() => this.translator.testTypeName(this.entry().testTypeKey));
	protected readonly unit = computed(() => this.translator.testTypeUnit(this.entry().testTypeKey));
	protected readonly period = computed(() => formatPeriod(this.entry().year, this.entry().month));

	protected readonly percentOptions = {
		min: 0,
		max: 100,
		step: 1,
		decimalPlaces: 2,
		placeholder: this.translator.t('Records_PercentPlaceholder')
	};
	protected readonly noteOptions = new InputOptions({
		placeholder: this.translator.t('Records_NotePlaceholder'),
		maxLength: 200
	});

	ngOnInit(): void {
		this.percent.set(this.entry().percent);
		this.note.set(this.entry().note);
		// The modal footer buttons are defined here because they depend on this form's state.
		this.modal.setActions([
			{
				type: ActionTypeEnum.Main,
				options: { text: this.translator.t('Records_Save'), onClick: () => this.save() }
			},
			{
				type: ActionTypeEnum.Secondary,
				options: { text: this.translator.t('Common_Cancel'), onClick: () => this.modal.toggleModal() }
			}
		]);
	}

	/** Validation errors are shown in the modal footer and the modal stays open. */
	private save(): void {
		const entry = this.entry();
		const input: CoverageInput = {
			teamId: entry.teamId,
			applicationId: entry.applicationId,
			testTypeKey: entry.testTypeKey,
			year: entry.year,
			month: entry.month,
			percent: this.percent() as number,
			note: this.note()
		};
		const error = this.store.validateEntry(input);
		if (error) {
			this.modal.setErrors({ message: this.translator.t(error) });
			return;
		}
		this.modal.clearErrors();

		// Changing a value that was already recorded needs an explicit confirmation.
		if (entry.percent !== input.percent || entry.note !== input.note.trim()) {
			this.feedback.confirm(
				{
					title: this.translator.t('Records_ConfirmChangeTitle'),
					description: this.translator.t('Records_ConfirmChangeText', {
						description: this.describe(),
						current: entry.percent,
						next: input.percent
					}),
					confirmLabel: this.translator.t('Records_ConfirmChangeButton')
				},
				() => this.commit(input)
			);
			return;
		}
		void this.commit(input);
	}

	private async commit(input: CoverageInput): Promise<void> {
		const result = await this.store.saveEntry(input);
		if (result.error) {
			this.modal.setErrors({ message: this.translator.t(result.error) });
			return;
		}
		const messages = {
			created: 'Records_Created',
			updated: 'Records_Updated',
			unchanged: 'Records_Unchanged'
		};
		this.modal.toggleModal();
		this.feedback.success(this.translator.t(messages[result.value]));
	}

	/** "Application · Test type · MM/YYYY", used in the confirmation message. */
	private describe(): string {
		return `${this.applicationName()} · ${this.typeName()} · ${this.period()}`;
	}
}
