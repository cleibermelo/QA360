import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	inject,
	Injector,
	OnInit,
	signal
} from '@angular/core';
import {
	ActionTypeEnum,
	ButtonComponent,
	ButtonOptions,
	ButtonTypeEnum,
	InputComponent,
	InputOptions,
	ModalService,
	NumericInputComponent,
	SingleSelectComponent
} from '@polygon/components';
import { CoverageStore } from '../../data/coverage.store';
import { CoverageInput, formatPeriod } from '../../domain/models';
import { FeedbackService } from '../../shared/feedback.service';
import { TranslatePipe } from '../../shared/translate.pipe';
import { Translator } from '../../shared/translator.service';

/** One line of the table: a coverage value for an application and test type of the chosen team and month. */
interface RecordRow {
	/** Stable key for tracking rows in the template. */
	key: number;
	applicationId: string;
	typeKey: string;
	percent: number | null;
	note: string;
	/** Active test types enabled on the row's application, translated for the select. */
	typeOptions: { key: string; name: string }[];
}

/**
 * Body of the "Create record" modal: team and month on top, then a table where the user adds
 * one line per application and test type to record, so several can be entered at once.
 */
@Component({
	selector: 'app-record-batch-form',
	imports: [SingleSelectComponent, NumericInputComponent, InputComponent, ButtonComponent, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: block;
		}
		.hint {
			margin: 0 0 16px;
			padding: 8px 12px;
			color: var(--grey-8);
			background: var(--grey-2);
			border-radius: 8px;
		}
		.top {
			display: grid;
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
			gap: 16px;
			margin-bottom: 24px;
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
		.empty {
			padding: 24px;
			text-align: center;
			color: var(--grey-8);
			background: var(--grey-2);
			border-radius: 8px;
		}
		/* Same columns in the header and in every line. */
		.line {
			display: grid;
			grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 1.3fr) 40px;
			gap: 12px;
			align-items: start;
			margin-bottom: 12px;
		}
		.line.header {
			margin-bottom: 4px;
		}
		.unit {
			display: block;
			margin-top: 2px;
			font-size: 11px;
			color: var(--grey-7);
		}
		po-button {
			margin-top: 2px;
		}
		po-button.add {
			display: block;
			margin-top: 12px;
		}
	`,
	template: `
		@if (hintOpen()) {
			<p class="hint">{{ 'Records_FormHint' | translate }}</p>
		}
		<div class="top">
			<div class="field">
				<span class="label required">{{ 'Common_Team' | translate }}</span>
				<po-single-select
					[defaultData]="{ data: teams() }"
					valueKey="id"
					labelKey="name"
					[placeholder]="'TeamPicker_Placeholder' | translate"
					[ariaLabel]="'Common_Team' | translate"
					[selectedValue]="teamId()"
					(selectedValueChange)="onTeamChange($any($event))" />
			</div>
			<div class="field">
				<span class="label required">{{ 'Records_Month' | translate }}</span>
				<po-single-select
					[defaultData]="{ data: months }"
					valueKey="value"
					labelKey="name"
					[ariaLabel]="'Records_Month' | translate"
					[selectedValue]="month()"
					(selectedValueChange)="month.set($any($event))" />
			</div>
			<div class="field">
				<span class="label required">{{ 'Records_Year' | translate }}</span>
				<po-single-select
					[defaultData]="{ data: years }"
					valueKey="value"
					labelKey="name"
					[ariaLabel]="'Records_Year' | translate"
					[selectedValue]="year()"
					(selectedValueChange)="year.set($any($event))" />
			</div>
		</div>

		@if (!teamId()) {
			<div class="empty">{{ 'Records_SelectTeamHint' | translate }}</div>
		} @else {
			@if (rows().length === 0) {
				<div class="empty">{{ 'Records_NoRowsHint' | translate }}</div>
			} @else {
				<div class="line header">
					<span class="label">{{ 'Common_Application' | translate }}</span>
					<span class="label">{{ 'Common_TestType' | translate }}</span>
					<span class="label">{{ 'Records_Coverage' | translate }} (%)</span>
					<span class="label">{{ 'Records_Note' | translate }}</span>
					<span></span>
				</div>
			}
			@for (row of rows(); track row.key; let i = $index) {
				<div class="line">
					<po-single-select
						[defaultData]="{ data: applications() }"
						valueKey="id"
						labelKey="name"
						[placeholder]="'Records_SelectApplication' | translate"
						[ariaLabel]="('Common_Application' | translate) + ' ' + (i + 1)"
						[selectedValue]="row.applicationId"
						(selectedValueChange)="onApplicationChange(row.key, $any($event))" />
					<po-single-select
						[defaultData]="{ data: row.typeOptions }"
						valueKey="key"
						labelKey="name"
						[placeholder]="'Common_SelectTestType' | translate"
						[ariaLabel]="('Common_TestType' | translate) + ' ' + (i + 1)"
						[selectedValue]="row.typeKey"
						(selectedValueChange)="update(row.key, { typeKey: $any($event) })" />
					<div>
						<po-numeric-input
							[options]="percentOptions"
							[value]="row.percent"
							(valueChange)="update(row.key, { percent: $event })"
							[ariaLabel]="('Records_Percent' | translate) + ' ' + (i + 1)" />
						@if (row.typeKey) {
							<span class="unit">{{ unitOf(row.typeKey) }}</span>
						}
					</div>
					<po-input
						[value]="row.note"
						(valueChange)="update(row.key, { note: $event })"
						[options]="noteOptions"
						[ariaLabel]="('Records_Note' | translate) + ' ' + (i + 1)" />
					<po-button [options]="removeButton" (action)="remove(row.key)" />
				</div>
			}
			<po-button class="add" [options]="addButton" (action)="add()" />
		}
	`
})
export class RecordBatchFormComponent implements OnInit {
	private readonly store = inject(CoverageStore);
	private readonly modal = inject(ModalService);
	private readonly feedback = inject(FeedbackService);
	private readonly translator = inject(Translator);
	private readonly destroyRef = inject(DestroyRef);
	private readonly injector = inject(Injector);

	private readonly today = new Date();
	protected readonly months = Array.from({ length: 12 }, (_, i) => ({
		value: i + 1,
		name: this.translator.monthName(i + 1)
	}));
	/** The last four years plus the current one. */
	protected readonly years = Array.from({ length: 6 }, (_, i) => {
		const value = this.today.getFullYear() - 4 + i;
		return { value, name: String(value) };
	});

	// The team starts empty so the user chooses it; the period defaults to the current month.
	protected readonly teamId = signal('');
	protected readonly month = signal(this.today.getMonth() + 1);
	protected readonly year = signal(this.today.getFullYear());
	protected readonly rows = signal<RecordRow[]>([]);
	/** The explanation stays hidden until the user clicks the info icon next to the modal title. */
	protected readonly hintOpen = signal(false);
	private nextKey = 0;

	protected readonly teams = computed(() => this.store.teams().map((t) => ({ id: t.id, name: t.name })));
	protected readonly applications = computed(() => this.store.getTeam(this.teamId())?.applications ?? []);

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
	protected readonly addButton = new ButtonOptions({
		text: this.translator.t('Records_AddRow'),
		icon: 'icon-add',
		type: ButtonTypeEnum.Secondary
	});
	protected readonly removeButton = new ButtonOptions({
		icon: 'icon-close',
		tooltip: this.translator.t('Records_RemoveRow'),
		type: ButtonTypeEnum.Text
	});

	ngOnInit(): void {
		afterNextRender(() => this.addInfoIconToTitle(), { injector: this.injector });
		this.modal.setActions([
			{
				type: ActionTypeEnum.Main,
				options: { text: this.translator.t('Records_SaveBatch'), onClick: () => this.save() }
			},
			{
				type: ActionTypeEnum.Secondary,
				options: { text: this.translator.t('Common_Cancel'), onClick: () => this.modal.toggleModal() }
			}
		]);
	}

	/** What the percentage means for a test type, e.g. "% of lines". */
	protected unitOf(typeKey: string): string {
		return this.translator.testTypeUnit(typeKey);
	}

	/** Choosing a team starts with no lines; the user adds only the ones they want to record. */
	protected onTeamChange(id: string): void {
		this.teamId.set(id);
		this.rows.set([]);
	}

	protected add(): void {
		this.rows.update((rows) => [...rows, this.newRow()]);
	}

	protected remove(key: number): void {
		this.rows.update((rows) => rows.filter((r) => r.key !== key));
	}

	protected update(key: number, changes: Partial<RecordRow>): void {
		this.rows.update((rows) => rows.map((r) => (r.key === key ? { ...r, ...changes } : r)));
	}

	/** Resets the test type; when the application has a single option it is preselected. */
	protected onApplicationChange(key: number, applicationId: string): void {
		const typeOptions = this.typeOptionsFor(applicationId);
		this.update(key, {
			applicationId,
			typeOptions,
			typeKey: typeOptions.length === 1 ? typeOptions[0].key : ''
		});
	}

	/** Lines without a percentage or note are ignored. Errors are shown in the modal footer, naming the line. */
	private save(): void {
		this.modal.clearErrors();
		if (!this.teamId()) {
			this.fail('Validation_SelectTeam');
			return;
		}
		const filled = this.rows()
			.map((row, index) => ({ row, number: index + 1 }))
			.filter(({ row }) => (row.percent !== null && row.percent !== undefined) || row.note.trim() !== '');
		if (filled.length === 0) {
			this.fail('Records_NothingToSave');
			return;
		}
		const inputs: CoverageInput[] = filled.map(({ row }) => ({
			teamId: this.teamId(),
			applicationId: row.applicationId,
			testTypeKey: row.typeKey,
			year: this.year(),
			month: this.month(),
			percent: row.percent as number,
			note: row.note
		}));

		const seen = new Set<string>();
		for (const [index, input] of inputs.entries()) {
			const key = `${input.applicationId}|${input.testTypeKey}`;
			const error = this.store.validateEntry(input) ?? (seen.has(key) ? 'Validation_RecordDuplicateRow' : null);
			if (error) {
				this.fail(error, filled[index].number);
				return;
			}
			seen.add(key);
		}

		// Changing values that were already recorded needs one explicit confirmation for the whole batch.
		const changes = inputs
			.map((input) => ({ input, existing: this.store.findEntry(input) }))
			.filter(
				({ input, existing }) =>
					existing && (existing.percent !== input.percent || existing.note !== input.note.trim())
			);
		if (changes.length > 0) {
			this.feedback.confirm(
				{
					title: this.translator.t('Records_ConfirmChangeTitle'),
					description: this.translator.t('Records_ConfirmBatchText', {
						period: formatPeriod(this.year(), this.month()),
						list: changes
							.map(({ input, existing }) => this.describeChange(input, existing.percent))
							.join('; ')
					}),
					confirmLabel: this.translator.t('Records_SaveBatch')
				},
				() => this.commit(inputs)
			);
			return;
		}
		void this.commit(inputs);
	}

	private async commit(inputs: CoverageInput[]): Promise<void> {
		const result = await this.store.saveEntries(inputs);
		if (result.error) {
			this.fail(result.error);
			return;
		}
		const changed = result.value.created + result.value.updated;
		this.modal.toggleModal();
		this.feedback.success(
			this.translator.t(changed > 0 ? 'Records_BatchSaved' : 'Records_Unchanged', { count: changed })
		);
	}

	/** The modal has no slot for the title, so the info button is added to its header element directly. */
	private addInfoIconToTitle(): void {
		const title = document.querySelector('.modal-container.qa360-record-form [data-testid="modal-header-title"]');
		if (!title) {
			return;
		}
		const label = this.translator.t('Records_InfoLabel');
		const button = document.createElement('button');
		button.type = 'button';
		button.title = label;
		button.setAttribute('aria-label', label);
		button.setAttribute('aria-expanded', 'false');
		button.style.cssText =
			'margin-left:8px;padding:0;border:0;background:none;cursor:pointer;color:var(--grey-8);font-size:18px;vertical-align:middle';
		const icon = document.createElement('span');
		icon.className = 'icon-info_circle';
		button.append(icon);
		button.addEventListener('click', () => {
			this.hintOpen.update((open) => !open);
			button.setAttribute('aria-expanded', String(this.hintOpen()));
		});
		title.append(button);
		this.destroyRef.onDestroy(() => button.remove());
	}

	private fail(error: string, rowNumber?: number): void {
		const prefix = rowNumber ? this.translator.t('Records_RowPrefix', { index: rowNumber }) : '';
		this.modal.setErrors({ message: prefix + this.translator.t(error) });
	}

	private newRow(applicationId = '', typeKey = ''): RecordRow {
		return {
			key: this.nextKey++,
			applicationId,
			typeKey,
			percent: null,
			note: '',
			typeOptions: this.typeOptionsFor(applicationId)
		};
	}

	/** Active test types enabled on the given application of the chosen team, translated. */
	private typeOptionsFor(applicationId: string): { key: string; name: string }[] {
		const keys = this.applications().find((a) => a.id === applicationId)?.testTypeKeys ?? [];
		return this.store
			.activeTestTypes()
			.filter((t) => keys.includes(t.key))
			.map((t) => ({ key: t.key, name: this.translator.testTypeName(t.key) }));
	}

	/** "Application · Test type: 60% → 70%", used in the confirmation message. */
	private describeChange(input: CoverageInput, current: number): string {
		const application = this.applications().find((a) => a.id === input.applicationId);
		const type = this.translator.testTypeName(input.testTypeKey);
		return `${application?.name ?? input.applicationId} · ${type}: ${current}% → ${input.percent}%`;
	}
}
