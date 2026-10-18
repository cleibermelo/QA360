import { effect, inject, Injectable, untracked } from '@angular/core';
import { ModalService } from '@polygon/components';
import { ColumnTypeEnum, DatagridActionType, IDatagridOptions } from '@polygon/qbuilder';
import { CoverageStore } from '../../data/coverage.store';
import { CoverageEntry, formatPeriod } from '../../domain/models';
import { FeedbackService } from '../../shared/feedback.service';
import { MinSearchDataSource } from '../../shared/min-search.datasource';
import { Translator } from '../../shared/translator.service';
import { openRecordModal } from './record-form.component';
import { openRecordHistoryModal } from './record-history.component';

/** One datagrid row; the grid requires an `id`. The key fields let actions find the entry again. */
interface RecordRow {
	id: string;
	teamId: string;
	applicationId: string;
	testTypeKey: string;
	year: number;
	month: number;
	team: string;
	period: string;
	application: string;
	testType: string;
	/** Phones show one column instead of two. */
	applicationAndType: string;
	percent: number;
	note: string;
	updatedAt: string;
}

/**
 * In-memory data source for the Polygon datagrid.
 * The datagrid calls the methods named in `method` and `cellClick` below on this class.
 */
@Injectable()
export class RecordsDataSource extends MinSearchDataSource {
	private readonly store = inject(CoverageStore);
	private readonly modal = inject(ModalService);
	private readonly feedback = inject(FeedbackService);
	private readonly translator = inject(Translator);
	/** The first effect run happens before the grid subscribes, so it must not trigger a refresh. */
	private skipFirstRefresh = true;

	constructor() {
		super();
		// Reloads the grid whenever records change (created, edited or deleted) or a team is renamed.
		effect(() => {
			this.store.entries();
			this.store.teams();
			if (this.skipFirstRefresh) {
				this.skipFirstRefresh = false;
				return;
			}
			untracked(() => this.refreshData());
		});
	}

	createRecord(): void {
		openRecordModal(this.modal, this.translator);
	}

	editRecord(row: RecordRow): void {
		const entry = this.entryOf(row);
		if (entry) {
			openRecordModal(this.modal, this.translator, entry);
		}
	}

	showHistory(row: RecordRow): void {
		const entry = this.entryOf(row);
		if (entry) {
			openRecordHistoryModal(this.modal, this.translator, entry);
		}
	}

	deleteRecord(row: RecordRow): void {
		const entry = this.entryOf(row);
		if (!entry) {
			return;
		}
		this.feedback.confirm(
			{
				title: this.translator.t('Records_ConfirmDeleteTitle'),
				description: this.translator.t('Records_ConfirmDeleteText', {
					description: `${row.application} · ${row.testType} · ${row.period}`,
					percent: row.percent
				}),
				confirmLabel: this.translator.t('Records_ConfirmDeleteButton'),
				destructive: true
			},
			async () => {
				const result = await this.store.removeEntry(entry);
				if (result.error) {
					this.feedback.error(this.translator.t(result.error));
					return;
				}
				this.feedback.success(this.translator.t('Records_Deleted'));
			}
		);
	}

	/** Builds the grid configuration in code instead of loading it from a JSON file. */
	protected override async setDatagridOptions(): Promise<void> {
		const t = (key: string): string => this.translator.t(key);
		// Phones only fit the essential columns; the hidden ones stay searchable or in the edit form.
		const compact = window.matchMedia('(max-width: 600px)').matches;
		const hiddenOnPhone = ['team', 'note', 'updatedAt', 'application', 'testType'];
		this.options = {
			id: 'qa360-records',
			title: t('Title_Records'),
			hideRefreshButton: true,
			canChangeColumnOptions: false,
			canChangeRowOptions: false,
			searchColumns: [
				{ label: t('Common_Application'), fields: 'application', default: true },
				{ label: t('Common_Team'), fields: 'team' }
			],
			columnOptions: [
				{ title: t('Common_Team'), field: 'team', type: ColumnTypeEnum.Text, sortable: true },
				{
					title: t('Records_Period'),
					field: 'period',
					type: ColumnTypeEnum.Text,
					width: compact ? 80 : undefined
				},
				{
					title: t('Common_Application'),
					field: 'application',
					type: ColumnTypeEnum.Text,
					sortable: true,
					cellClick: 'editRecord'
				},
				{ title: t('Common_TestType'), field: 'testType', type: ColumnTypeEnum.Text, sortable: true },
				{
					title: t('Common_Application'),
					field: 'applicationAndType',
					type: ColumnTypeEnum.Text,
					width: 170,
					cellClick: 'editRecord'
				},
				{
					title: `${t('Records_Coverage')} (%)`,
					field: 'percent',
					type: ColumnTypeEnum.Number,
					sortable: true,
					class: 'qa360-center-cell'
				},
				{ title: t('Records_Note'), field: 'note', type: ColumnTypeEnum.Text },
				{ title: t('Records_UpdatedAt'), field: 'updatedAt', type: ColumnTypeEnum.Text }
			].filter((column) =>
				compact ? !hiddenOnPhone.includes(column.field) : column.field !== 'applicationAndType'
			),
			actions: [
				// "Footer" actions are rendered by Polygon as the primary button in the page header.
				{ title: t('Records_Create'), type: DatagridActionType.Footer, method: 'createRecord' },
				{ title: t('Records_Create'), type: DatagridActionType.EmptyStateCreate, method: 'createRecord' },
				// Row actions appear in the "⋮" menu of each row.
				{
					title: t('Records_MoreActions'),
					type: DatagridActionType.Row,
					icon: 'icon-more_vertical',
					subActions: [
						{ title: t('Common_Edit'), type: DatagridActionType.Row, method: 'editRecord' },
						{ title: t('Common_History'), type: DatagridActionType.Row, method: 'showHistory' },
						{ title: t('Common_Delete'), type: DatagridActionType.Row, method: 'deleteRecord' }
					]
				}
			]
			// The options type requires fields (like a data URL) that do not apply to an in-memory source.
		} as unknown as IDatagridOptions;
	}

	/** Supplies the rows (newest period first); the datagrid expects them under `result`. */
	protected override async getApiData(): Promise<unknown> {
		const rows: RecordRow[] = this.store
			.entries()
			.map((e) => this.toRow(e))
			.sort(
				(a, b) =>
					b.year - a.year ||
					b.month - a.month ||
					a.team.localeCompare(b.team) ||
					a.application.localeCompare(b.application) ||
					a.testType.localeCompare(b.testType)
			);
		return { result: rows };
	}

	private toRow(e: CoverageEntry): RecordRow {
		const team = this.store.getTeam(e.teamId);
		const application = team?.applications.find((a) => a.id === e.applicationId);
		return {
			id: `${e.teamId}|${e.applicationId}|${e.testTypeKey}|${e.year}|${e.month}`,
			teamId: e.teamId,
			applicationId: e.applicationId,
			testTypeKey: e.testTypeKey,
			year: e.year,
			month: e.month,
			team: team?.name ?? e.teamId,
			period: formatPeriod(e.year, e.month),
			application: application?.name ?? e.applicationId,
			testType: this.translator.testTypeName(e.testTypeKey),
			applicationAndType: `${application?.name ?? e.applicationId} · ${this.translator.testTypeName(e.testTypeKey)}`,
			percent: e.percent,
			note: e.note || '—',
			updatedAt: new Date(e.updatedAt).toLocaleString(this.translator.locale, {
				dateStyle: 'short',
				timeStyle: 'short'
			})
		};
	}

	private entryOf(row: RecordRow): CoverageEntry | undefined {
		return this.store.findEntry(row);
	}
}
