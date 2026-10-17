import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import {
	ActionTypeEnum,
	ButtonComponent,
	ButtonOptions,
	ButtonTypeEnum,
	InputComponent,
	InputOptions,
	ModalOptions,
	ModalService,
	MultiSelectComponent,
	SizeEnum
} from '@polygon/components';
import { CoverageStore } from '../../data/coverage.store';
import { FeedbackService } from '../../shared/feedback.service';
import { TranslatePipe } from '../../shared/translate.pipe';
import { Translator } from '../../shared/translator.service';

/** One editable application line in the form. `id` is set only for applications that already exist. */
interface ApplicationRow {
	/** Stable key for tracking rows in the template; unrelated to the application id. */
	key: number;
	id?: string;
	name: string;
	testTypeKeys: string[];
}

/** Opens the team form in a modal. Without `teamId` it creates a new team. */
export const openTeamModal = (modal: ModalService, translator: Translator, teamId?: string): void => {
	modal.toggleModal(
		new ModalOptions({
			id: 'qa360-team-form',
			title: signal(translator.t(teamId ? 'TeamForm_TitleEdit' : 'TeamForm_TitleCreate')),
			size: signal(SizeEnum.Large),
			closeOnOutsideClick: signal(false),
			component: { componentClass: TeamFormComponent, inputs: { teamId } }
		})
	);
};

/** Body of the team modal: team name plus a repeatable list of applications and their test types. */
@Component({
	selector: 'app-team-form',
	imports: [InputComponent, MultiSelectComponent, ButtonComponent, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: block;
		}
		.field {
			display: flex;
			flex-direction: column;
			gap: 4px;
			margin-bottom: 16px;
		}
		.label {
			font-size: 12px;
			color: var(--grey-8);
		}
		.required::after {
			content: ' *';
			color: var(--error-100);
		}
		h4 {
			margin: 24px 0 4px;
			color: var(--grey-9);
		}
		.hint {
			margin: 0 0 12px;
			color: var(--grey-8);
			font-size: 12px;
		}
		/* Not named ".row": that class collides with a global theme rule. */
		.application-row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
			gap: 16px;
			align-items: end;
		}
		.application-row .field {
			margin-bottom: 12px;
		}
		.application-row po-button {
			margin-bottom: 12px;
		}
	`,
	template: `
		<div class="field">
			<span class="label required">{{ 'TeamForm_Name' | translate }}</span>
			<po-input [(value)]="name" [options]="nameOptions" [ariaLabel]="'TeamForm_Name' | translate" />
		</div>

		<h4>{{ 'TeamForm_ApplicationsHeading' | translate }}</h4>
		<p class="hint">{{ 'TeamForm_ApplicationsHint' | translate }}</p>
		@for (row of rows(); track row.key) {
			<div class="application-row">
				<div class="field">
					<span class="label">{{ 'Common_Application' | translate }}</span>
					<po-input
						[value]="row.name"
						(valueChange)="update(row.key, { name: $event })"
						[options]="applicationOptions"
						[ariaLabel]="'TeamForm_ApplicationName' | translate" />
				</div>
				<div class="field">
					<span class="label">{{ 'Common_TestTypes' | translate }}</span>
					<po-multi-select
						[defaultData]="{ data: typeOptions() }"
						valueKey="key"
						labelKey="name"
						[placeholder]="'TeamForm_SelectTestTypes' | translate"
						[ariaLabel]="'Common_TestTypes' | translate"
						[selectedValue]="row.testTypeKeys"
						(selectedValueChange)="update(row.key, { testTypeKeys: $any($event) })" />
				</div>
				<po-button [options]="removeButton" (action)="remove(row.key)" />
			</div>
		}
		<po-button [options]="addButton" (action)="add()" />
	`
})
export class TeamFormComponent implements OnInit {
	/** Set by the modal; empty when creating. */
	readonly teamId = input<string>();

	private readonly store = inject(CoverageStore);
	private readonly modal = inject(ModalService);
	private readonly feedback = inject(FeedbackService);
	private readonly translator = inject(Translator);

	protected readonly name = signal('');
	protected readonly rows = signal<ApplicationRow[]>([]);
	/** Test types already enabled when the form opened, so inactive ones are not silently dropped on edit. */
	private readonly initialKeys = signal<string[]>([]);
	private nextKey = 0;

	/** Active test types (plus the inactive ones already in use), translated for the select. */
	protected readonly typeOptions = computed(() =>
		this.store
			.testTypes()
			.filter((t) => t.active || this.initialKeys().includes(t.key))
			.map((t) => ({ key: t.key, name: this.translator.testTypeName(t.key) }))
	);
	/** Save only needs a team name; per-application problems are reported when saving. */
	private readonly canSave = computed(() => this.name().trim().length > 0);

	protected readonly nameOptions = new InputOptions({
		placeholder: this.translator.t('TeamForm_NamePlaceholder'),
		maxLength: 60
	});
	protected readonly applicationOptions = new InputOptions({
		placeholder: this.translator.t('TeamForm_ApplicationPlaceholder'),
		maxLength: 60
	});
	protected readonly addButton = new ButtonOptions({
		text: this.translator.t('TeamForm_Add'),
		icon: 'icon-add',
		type: ButtonTypeEnum.Secondary
	});
	protected readonly removeButton = new ButtonOptions({
		icon: 'icon-close',
		tooltip: this.translator.t('TeamForm_Remove'),
		type: ButtonTypeEnum.Text
	});

	ngOnInit(): void {
		const team = this.teamId() ? this.store.getTeam(this.teamId()) : undefined;
		if (team) {
			this.name.set(team.name);
			this.rows.set(
				team.applications.map((a) => ({
					key: this.nextKey++,
					id: a.id,
					name: a.name,
					testTypeKeys: a.testTypeKeys
				}))
			);
			this.initialKeys.set(team.applications.flatMap((a) => a.testTypeKeys));
		}
		// The modal footer buttons are defined here because they depend on this form's state.
		this.modal.setActions([
			{
				type: ActionTypeEnum.Main,
				options: { text: this.translator.t('TeamForm_Save'), onClick: () => this.save() },
				disabled: computed(() => !this.canSave())
			},
			{
				type: ActionTypeEnum.Secondary,
				options: { text: this.translator.t('Common_Cancel'), onClick: () => this.modal.toggleModal() }
			}
		]);
	}

	protected add(): void {
		this.rows.update((rows) => [...rows, { key: this.nextKey++, name: '', testTypeKeys: [] }]);
	}

	protected remove(key: number): void {
		this.rows.update((rows) => rows.filter((r) => r.key !== key));
	}

	protected update(key: number, changes: Partial<ApplicationRow>): void {
		this.rows.update((rows) => rows.map((r) => (r.key === key ? { ...r, ...changes } : r)));
	}

	/** Asks for confirmation first when saving would delete existing applications (and their entries). */
	private save(): void {
		const team = this.teamId() ? this.store.getTeam(this.teamId()) : undefined;
		const removed = (team?.applications ?? []).filter((a) => !this.rows().some((r) => r.id === a.id));
		if (removed.length === 0) {
			void this.commit();
			return;
		}
		this.feedback.confirm(
			{
				title: this.translator.t('TeamForm_RemoveTitle'),
				description: this.translator.t('TeamForm_RemoveText', { names: removed.map((a) => a.name).join(', ') }),
				confirmLabel: this.translator.t('TeamForm_RemoveButton'),
				destructive: true
			},
			() => this.commit()
		);
	}

	/** Saves through the store; errors are shown in the modal footer and the modal stays open. */
	private async commit(): Promise<void> {
		this.modal.clearErrors();
		const result = await this.store.saveTeam({
			teamId: this.teamId(),
			name: this.name(),
			applications: this.rows().map((r) => ({ id: r.id, name: r.name, testTypeKeys: r.testTypeKeys }))
		});
		if (result.error) {
			// Errors of an application line say which line, e.g. "Application 2: Enter the application name."
			const prefix = result.errorParams
				? this.translator.t('TeamForm_ApplicationPrefix', result.errorParams)
				: '';
			this.modal.setErrors({ message: prefix + this.translator.t(result.error, result.messageParams) });
			return;
		}
		this.modal.toggleModal();
		this.feedback.success(
			this.translator.t(this.teamId() ? 'TeamForm_Updated' : 'TeamForm_Created', {
				name: result.value?.name ?? this.name().trim()
			})
		);
	}
}
