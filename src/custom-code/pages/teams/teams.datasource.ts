import { effect, inject, Injectable, untracked } from '@angular/core';
import { ModalService } from '@polygon/components';
import { ColumnTypeEnum, DatagridActionType, IDatagridOptions } from '@polygon/qbuilder';
import { CoverageStore } from '../../data/coverage.store';
import { FeedbackService } from '../../shared/feedback.service';
import { MinSearchDataSource } from '../../shared/min-search.datasource';
import { Translator } from '../../shared/translator.service';
import { openTeamModal } from './team-form.component';

/** One datagrid row; the grid requires an `id`. */
interface TeamRow {
	id: string;
	name: string;
	/** Application names joined for display. */
	applications: string;
	/** Test types enabled on any of the team's applications, joined for display. */
	testTypes: string;
	applicationCount: number;
}

/**
 * In-memory data source for the Polygon datagrid.
 * The datagrid calls the methods named in `method` and `cellClick` below on this class.
 */
@Injectable()
export class TeamsDataSource extends MinSearchDataSource {
	private readonly store = inject(CoverageStore);
	private readonly modal = inject(ModalService);
	private readonly feedback = inject(FeedbackService);
	private readonly translator = inject(Translator);
	/** The first effect run happens before the grid subscribes, so it must not trigger a refresh. */
	private skipFirstRefresh = true;

	constructor() {
		super();
		// Reloads the grid whenever teams change (created, edited or deleted).
		effect(() => {
			this.store.teams();
			if (this.skipFirstRefresh) {
				this.skipFirstRefresh = false;
				return;
			}
			untracked(() => this.refreshData());
		});
	}

	createTeam(): void {
		openTeamModal(this.modal, this.translator);
	}

	editTeam(row: TeamRow): void {
		openTeamModal(this.modal, this.translator, row.id);
	}

	deleteTeam(row: TeamRow): void {
		this.feedback.confirm(
			{
				title: this.translator.t('Teams_DeleteTitle'),
				description: this.translator.t('Teams_DeleteText', { name: row.name, count: row.applicationCount }),
				confirmLabel: this.translator.t('Teams_DeleteButton'),
				destructive: true
			},
			async () => {
				const result = await this.store.removeTeam(row.id);
				if (result.error) {
					this.feedback.error(this.translator.t(result.error));
					return;
				}
				this.feedback.success(this.translator.t('Teams_Deleted', { name: row.name }));
			}
		);
	}

	/** Builds the grid configuration in code instead of loading it from a JSON file. */
	protected override async setDatagridOptions(): Promise<void> {
		const t = (key: string): string => this.translator.t(key);
		this.options = {
			id: 'qapulse-teams',
			title: t('Title_Teams'),
			hideRefreshButton: true,
			canChangeColumnOptions: false,
			canChangeRowOptions: false,
			searchColumns: [{ label: t('Teams_SearchLabel'), fields: 'name', default: true }],
			columnOptions: [
				{
					title: t('Common_Team'),
					field: 'name',
					type: ColumnTypeEnum.Text,
					sortable: true,
					cellClick: 'editTeam'
				},
				{ title: t('Teams_ColApplications'), field: 'applications', type: ColumnTypeEnum.Text },
				{ title: t('Common_TestType'), field: 'testTypes', type: ColumnTypeEnum.Text }
			],
			actions: [
				// "Footer" actions are rendered by Polygon as the primary button in the page header.
				{ title: t('Teams_Create'), type: DatagridActionType.Footer, method: 'createTeam' },
				{ title: t('Teams_Create'), type: DatagridActionType.EmptyStateCreate, method: 'createTeam' },
				// Row actions appear in the "⋮" menu of each row.
				{
					title: t('Teams_MoreActions'),
					type: DatagridActionType.Row,
					icon: 'icon-more_vertical',
					subActions: [
						{ title: t('Common_Edit'), type: DatagridActionType.Row, method: 'editTeam' },
						{ title: t('Common_Delete'), type: DatagridActionType.Row, method: 'deleteTeam' }
					]
				}
			]
			// The options type requires fields (like a data URL) that do not apply to an in-memory source.
		} as unknown as IDatagridOptions;
	}

	/** Supplies the rows; the datagrid expects them under `result`. */
	protected override async getApiData(): Promise<unknown> {
		const rows: TeamRow[] = this.store.teams().map((t) => ({
			id: t.id,
			name: t.name,
			applications: t.applications.map((a) => a.name).join(', ') || '—',
			testTypes:
				this.store
					.testTypes()
					.filter((type) => t.applications.some((a) => a.testTypeKeys.includes(type.key)))
					.map((type) => this.translator.testTypeName(type.key))
					.join(', ') || '—',
			applicationCount: t.applications.length
		}));
		return { result: rows };
	}
}
