import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OutletEnum, ViewTitleService } from '@polygon/core';
import { DATA_SOURCE, DataGridViewerAllDataComponent } from '@polygon/qbuilder';
import { Translator } from '../../shared/translator.service';
import { RecordsDataSource } from './records.datasource';

/** Coverage records: a Polygon datagrid backed by the in-memory `RecordsDataSource`, same pattern as the teams list. */
@Component({
	selector: 'app-records-list',
	imports: [DataGridViewerAllDataComponent],
	// The viewer instantiates whatever class is provided under DATA_SOURCE.
	providers: [{ provide: DATA_SOURCE, useValue: RecordsDataSource }],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: flex;
			height: calc(100vh - 160px);
			min-height: 400px;
			padding: 24px;
		}
	`,
	template: `<po-datagrid-viewer-all-data />`
})
export class RecordsListComponent {
	constructor() {
		inject(ViewTitleService).setViewTitleMetadata({
			outlet: OutletEnum.Primary,
			title: inject(Translator).t('Title_Records')
		});
	}
}
