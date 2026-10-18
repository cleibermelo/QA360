import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OutletEnum, ViewTitleService } from '@polygon/core';
import { DATA_SOURCE, DataGridViewerAllDataComponent } from '@polygon/qbuilder';
import { Translator } from '../../shared/translator.service';
import { TeamsDataSource } from './teams.datasource';

/** Team list: a Polygon datagrid backed by the in-memory `TeamsDataSource`. */
@Component({
	selector: 'app-teams-list',
	imports: [DataGridViewerAllDataComponent],
	// The viewer instantiates whatever class is provided under DATA_SOURCE.
	providers: [{ provide: DATA_SOURCE, useValue: TeamsDataSource }],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: flex;
			height: calc(100vh - 160px);
			min-height: 400px;
			padding: 24px;
		}
		@media (max-width: 600px) {
			:host {
				padding: 8px;
			}
		}
	`,
	template: `<po-datagrid-viewer-all-data />`
})
export class TeamsListComponent {
	constructor() {
		inject(ViewTitleService).setViewTitleMetadata({
			outlet: OutletEnum.Primary,
			title: inject(Translator).t('Title_Teams')
		});
	}
}
