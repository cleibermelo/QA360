import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import {
	ButtonComponent,
	ButtonOptions,
	ButtonTypeEnum,
	MonthInputComponent,
	MultiSelectComponent,
	SingleSelectComponent
} from '@polygon/components';
import { OutletEnum, ViewTitleService } from '@polygon/core';
import { CoverageLineChartComponent } from '../../components/coverage-line-chart/coverage-line-chart.component';
import { CoverageStore } from '../../data/coverage.store';
import { buildChartData, ChartData } from '../../domain/dashboard';
import { TeamPickerComponent } from '../../shared/team-picker.component';
import { TranslatePipe } from '../../shared/translate.pipe';
import { Translator } from '../../shared/translator.service';
import { DashboardFiltersState } from './dashboard-filters.state';

const EMPTY_CHART: ChartData = { labels: [], series: [] };

/** Monthly coverage evolution: filters, line chart and a table with the same values for checking. */
@Component({
	selector: 'app-dashboard',
	imports: [
		TeamPickerComponent,
		SingleSelectComponent,
		MultiSelectComponent,
		MonthInputComponent,
		ButtonComponent,
		CoverageLineChartComponent,
		TranslatePipe
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrl: '../page.scss',
	template: `
		<section class="page-section">
			@for (key of [filtersKey()]; track key) {
				<div class="filters">
					<app-team-picker />
					<div class="field application-field">
						<span class="label">{{ 'Common_Application' | translate }}</span>
						<po-multi-select
							[class.has-selection]="applicationIds().length > 0"
							[defaultData]="{ data: applicationOptions() }"
							valueKey="id"
							labelKey="name"
							[placeholder]="'Dashboard_ApplicationsPlaceholder' | translate"
							[ariaLabel]="'Common_Application' | translate"
							[selectedValue]="applicationIds()"
							(selectedValueChange)="applicationIds.set($any($event))" />
					</div>
					<div class="field">
						<span class="label">{{ 'Common_TestType' | translate }}</span>
						@for (reset of [typeSelectReset()]; track reset) {
							<po-single-select
								[defaultData]="{ data: typeOptions() }"
								valueKey="key"
								labelKey="name"
								[placeholder]="'Common_SelectTestType' | translate"
								[ariaLabel]="'Common_TestType' | translate"
								[selectedValue]="typeKey()"
								(selectedValueChange)="typeKey.set($any($event))" />
						}
					</div>
					<div class="period">
						<div class="field">
							<span class="label">{{ 'Dashboard_From' | translate }}</span>
							<po-month-input
								[value]="from()"
								(valueChange)="setFrom($event)"
								[ariaLabel]="'Dashboard_From' | translate" />
						</div>
						<div class="field">
							<span class="label">{{ 'Dashboard_To' | translate }}</span>
							<po-month-input
								[value]="to()"
								(valueChange)="setTo($event)"
								[ariaLabel]="'Dashboard_To' | translate" />
						</div>
					</div>
					<po-button [options]="clearButton" (action)="clearFilters()" />
				</div>
			}
		</section>

		<section class="page-section">
			@if (!store.selectedTeamId()) {
				<div class="empty">{{ 'Dashboard_SelectTeam' | translate }}</div>
			} @else if (applicationIds().length === 0) {
				<div class="empty">{{ 'Dashboard_SelectApplications' | translate }}</div>
			} @else if (!typeKey()) {
				<div class="empty">{{ 'Dashboard_SelectTestType' | translate }}</div>
			} @else if (!from() || !to()) {
				<div class="empty">{{ 'Dashboard_SelectPeriod' | translate }}</div>
			} @else if (rangeIsInverted()) {
				<div class="empty">{{ 'Dashboard_InvalidRange' | translate }}</div>
			} @else if (data().series.length === 0) {
				<div class="empty">{{ 'Dashboard_Empty' | translate }}</div>
			} @else {
				<app-coverage-line-chart [labels]="data().labels" [series]="data().series" />
			}
		</section>

		@if (data().series.length > 0) {
			<section class="page-section">
				<h3>
					<button
						type="button"
						class="collapse-toggle"
						[attr.aria-expanded]="valuesOpen()"
						(click)="valuesOpen.set(!valuesOpen())">
						<span>{{ 'Dashboard_Values' | translate }}</span>
						<span [class]="valuesOpen() ? 'icon-expand_less' : 'icon-expand_more'"></span>
					</button>
				</h3>
				@if (valuesOpen()) {
					<table class="data-table">
						<thead>
							<tr>
								<th>{{ 'Dashboard_MonthYear' | translate }}</th>
								@for (s of data().series; track s.name) {
									<th class="number">{{ s.name }}</th>
								}
							</tr>
						</thead>
						<tbody>
							@for (label of data().labels; track label; let i = $index) {
								<tr>
									<td>{{ label }}</td>
									@for (s of data().series; track s.name) {
										<td class="number">
											@if (s.values[i] !== null) {
												{{ s.values[i] }}%
											} @else {
												<span class="muted">—</span>
											}
										</td>
									}
								</tr>
							}
						</tbody>
					</table>
				}
			</section>
		}
	`
})
export class DashboardComponent {
	protected readonly store = inject(CoverageStore);
	private readonly translator = inject(Translator);
	private readonly filters = inject(DashboardFiltersState);

	// The filters live in a service, so they are still there when the user leaves the Dashboard and comes back.
	/** Selected applications; the chart only shows them, so none selected means no chart. */
	protected readonly applicationIds = this.filters.applicationIds;
	protected readonly typeKey = this.filters.typeKey;
	/** The table with the plotted values starts collapsed; the arrow in its title opens it. */
	protected readonly valuesOpen = this.filters.valuesOpen;
	/** Month range (`YYYY-MM`); the chart is only built once both ends are filled. */
	protected readonly from = this.filters.from;
	protected readonly to = this.filters.to;
	protected readonly rangeIsInverted = computed(
		() => this.from() !== '' && this.to() !== '' && this.from() > this.to()
	);
	/** The select does not clear its text when the value is reset, so a new key makes it render again. */
	protected readonly typeSelectReset = signal(0);
	/** Clearing the filters renders them all again, because the selects do not clear their text by themselves. */
	protected readonly filtersKey = signal(0);
	protected readonly clearButton = new ButtonOptions({
		text: this.translator.t('Dashboard_Reset'),
		type: ButtonTypeEnum.Text
	});

	/** Applications of the selected team. */
	protected readonly applicationOptions = computed(() => this.store.selectedTeam()?.applications ?? []);

	/** Active test types enabled on the selected applications, translated; none until an application is selected. */
	protected readonly typeOptions = computed(() => {
		const selected = this.applicationIds();
		const scoped = this.applicationOptions().filter((a) => selected.includes(a.id));
		const keys = new Set(scoped.flatMap((a) => a.testTypeKeys));
		return this.store
			.activeTestTypes()
			.filter((t) => keys.has(t.key))
			.map((t) => ({ key: t.key, name: this.translator.testTypeName(t.key) }));
	});

	protected readonly data = computed(() => {
		if (!this.from() || !this.to() || this.rangeIsInverted()) {
			return EMPTY_CHART;
		}
		return buildChartData(this.store.entries(), this.store.selectedTeam(), this.applicationIds(), this.typeKey(), {
			from: this.from(),
			to: this.to()
		});
	});

	constructor() {
		inject(ViewTitleService).setViewTitleMetadata({
			outlet: OutletEnum.Primary,
			title: this.translator.t('Title_Dashboard')
		});
		// Drops selected applications that no longer exist (team changed or application removed).
		effect(() => {
			const existing = this.applicationOptions().map((a) => a.id);
			const current = untracked(this.applicationIds);
			const valid = current.filter((id) => existing.includes(id));
			if (valid.length !== current.length) {
				this.applicationIds.set(valid);
			}
		});
		// Clears the test type when it is no longer offered (e.g. all applications deselected); the user always picks it.
		effect(() => {
			const options = this.typeOptions();
			if (!options.some((t) => t.key === untracked(this.typeKey))) {
				if (untracked(this.typeKey) !== '') {
					this.typeSelectReset.update((n) => n + 1);
				}
				this.typeKey.set('');
			}
		});
	}

	/** Empties every filter, which also empties the chart. */
	protected clearFilters(): void {
		this.filters.reset();
		this.filtersKey.update((n) => n + 1);
	}

	/** The month input also emits partial or invalid text while typing; only complete months count. */
	protected setFrom(value: string | null): void {
		this.from.set(this.validMonth(value));
	}

	protected setTo(value: string | null): void {
		this.to.set(this.validMonth(value));
	}

	private validMonth(value: string | null): string {
		return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : '';
	}
}
