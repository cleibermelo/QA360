import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { ActionTypeEnum, ModalOptions, ModalService, SizeEnum } from '@polygon/components';
import { CoverageStore } from '../../data/coverage.store';
import { CoverageEntry, formatPeriod } from '../../domain/models';
import { TranslatePipe } from '../../shared/translate.pipe';
import { Translator } from '../../shared/translator.service';

/** Opens the history of a record (date and previous value of every change) in a modal. */
export const openRecordHistoryModal = (modal: ModalService, translator: Translator, entry: CoverageEntry): void => {
	modal.toggleModal(
		new ModalOptions({
			id: 'qa360-record-history',
			title: signal(translator.t('Records_HistoryTitle')),
			size: signal(SizeEnum.Regular),
			closeOnOutsideClick: signal(true),
			component: { componentClass: RecordHistoryComponent, inputs: { entry } }
		})
	);
};

/** Body of the history modal. */
@Component({
	selector: 'app-record-history',
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: block;
		}
		.summary {
			margin: 0 0 16px;
			color: var(--grey-9);
		}
		.empty {
			padding: 24px;
			text-align: center;
			color: var(--grey-8);
			background: var(--grey-2);
			border-radius: 8px;
		}
		table {
			width: 100%;
			border-collapse: collapse;
		}
		th,
		td {
			padding: 8px 12px;
			text-align: left;
			border-bottom: 1px solid var(--grey-4);
		}
		th {
			font-size: 12px;
			color: var(--grey-8);
			background: var(--grey-2);
		}
		td.number,
		th.number {
			text-align: right;
		}
	`,
	template: `
		<p class="summary">{{ description() }}</p>
		@if (entry().history.length === 0) {
			<div class="empty">{{ 'Records_HistoryEmpty' | translate }}</div>
		} @else {
			<table>
				<thead>
					<tr>
						<th>{{ 'Records_HistoryChangedAt' | translate }}</th>
						<th class="number">{{ 'Records_HistoryPrevious' | translate }}</th>
						<th>{{ 'Records_Note' | translate }}</th>
					</tr>
				</thead>
				<tbody>
					@for (item of entry().history; track item.changedAt) {
						<tr>
							<td>{{ formatDate(item.changedAt) }}</td>
							<td class="number">{{ item.previousPercent }}%</td>
							<td>{{ item.previousNote || '—' }}</td>
						</tr>
					}
				</tbody>
			</table>
		}
	`
})
export class RecordHistoryComponent implements OnInit {
	readonly entry = input.required<CoverageEntry>();

	private readonly store = inject(CoverageStore);
	private readonly modal = inject(ModalService);
	private readonly translator = inject(Translator);

	ngOnInit(): void {
		this.modal.setActions([
			{
				type: ActionTypeEnum.Secondary,
				options: { text: this.translator.t('Common_Close'), onClick: () => this.modal.toggleModal() }
			}
		]);
	}

	/** "Team · Application · Test type · MM/YYYY". */
	protected description(): string {
		const e = this.entry();
		const team = this.store.getTeam(e.teamId);
		const application = team?.applications.find((a) => a.id === e.applicationId);
		return [
			team?.name ?? e.teamId,
			application?.name ?? e.applicationId,
			this.translator.testTypeName(e.testTypeKey),
			formatPeriod(e.year, e.month)
		].join(' · ');
	}

	protected formatDate(iso: string): string {
		return new Date(iso).toLocaleString(this.translator.locale, { dateStyle: 'short', timeStyle: 'short' });
	}
}
