import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
	ButtonColorEnum,
	ButtonComponent,
	ButtonOptions,
	ButtonTypeEnum,
	MonthInputComponent,
	MultiSelectComponent
} from '@polygon/components';
import { OutletEnum, ViewTitleService } from '@polygon/core';
import { CoverageLineChartComponent } from '../../components/coverage-line-chart/coverage-line-chart.component';
import { SonarCoverageService, SonarProject } from '../../data/sonar-coverage.service';
import { ChartData, ChartSeries } from '../../domain/dashboard';
import { MonthlyCoverage, monthRange, monthStart } from '../../domain/sonar-coverage';
import { TranslatePipe } from '../../shared/translate.pipe';
import { Translator } from '../../shared/translator.service';
import { SonarcloudFiltersState } from './sonarcloud-filters.state';

/** The chart theme has this many distinct line colors; beyond it they repeat. */
const PALETTE_SIZE = 6;

interface ChartView extends ChartData {
	/** Full month name for each label, shown in the tooltip. */
	titles: string[];
}

interface TableRow {
	key: string;
	name: string;
	coverage: number | null;
	measuredOn: string;
}

const EMPTY_CHART: ChartView = { labels: [], titles: [], series: [] };

/** Coverage that the daily job copies from SonarCloud: project and period filters, the month table and the chart. */
@Component({
	selector: 'app-sonarcloud',
	imports: [MultiSelectComponent, MonthInputComponent, ButtonComponent, CoverageLineChartComponent, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrl: '../page.scss',
	styles: `
		.project-field {
			width: 480px;
		}
		.project-field po-multi-select {
			width: 100%;
		}
		.hint {
			margin: 12px 0 0;
		}
		.project-name {
			overflow-wrap: anywhere;
		}
		@media (max-width: 600px) {
			.project-field {
				width: 100%;
			}
		}
	`,
	template: `
		<section class="page-section">
			@for (key of [filtersKey()]; track key) {
				<div class="filters">
					<div class="field project-field">
						<span class="label">{{ 'Sonar_Project' | translate }}</span>
						<po-multi-select
							[class.has-selection]="projectKeys().length > 0"
							[defaultData]="{ data: projects() }"
							valueKey="key"
							labelKey="name"
							[placeholder]="'Sonar_ProjectPlaceholder' | translate"
							[ariaLabel]="'Sonar_Project' | translate"
							[selectedValue]="projectKeys()"
							(selectedValueChange)="selectProjects($any($event))" />
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
			@if (projectKeys().length > paletteSize) {
				<p class="hint">{{ 'Sonar_ManyProjects' | translate: { count: paletteSize } }}</p>
			}
		</section>

		@if (loadError()) {
			<section class="page-section">
				<div class="empty">{{ 'Error_Load' | translate }}</div>
			</section>
		} @else if (loading() || busy()) {
			<section class="page-section">
				<div class="empty">{{ 'Sonar_Loading' | translate }}</div>
			</section>
		} @else if (projects().length === 0) {
			<section class="page-section">
				<div class="empty">{{ 'Sonar_NoData' | translate }}</div>
			</section>
		} @else if (projectKeys().length === 0) {
			<section class="page-section">
				<div class="empty">{{ 'Sonar_SelectProject' | translate }}</div>
			</section>
		} @else {
			<section class="page-section">
				<div class="filters">
					<div class="field">
						<span class="label">{{ 'Sonar_Month' | translate }}</span>
						<po-month-input
							[value]="month()"
							(valueChange)="setMonth($event)"
							[ariaLabel]="'Sonar_Month' | translate" />
					</div>
				</div>
				@if (!month()) {
					<div class="empty">{{ 'Sonar_SelectMonth' | translate }}</div>
				} @else {
					<table class="data-table">
						<thead>
							<tr>
								<th>{{ 'Sonar_Project' | translate }}</th>
								<th class="number">{{ 'Sonar_Coverage' | translate }}</th>
								<th>{{ 'Sonar_MeasuredOn' | translate }}</th>
							</tr>
						</thead>
						<tbody>
							@for (row of rows(); track row.key) {
								<tr>
									<td class="project-name">{{ row.name }}</td>
									@if (row.coverage !== null) {
										<td class="number">{{ row.coverage }}%</td>
										<td>{{ row.measuredOn }}</td>
									} @else {
										<td class="number muted">—</td>
										<td class="muted">{{ 'Sonar_NoMeasurement' | translate }}</td>
									}
								</tr>
							}
						</tbody>
					</table>
				}
			</section>

			<section class="page-section">
				<h3>{{ 'Sonar_History' | translate }}</h3>
				@if (!from() || !to()) {
					<div class="empty">{{ 'Sonar_SelectPeriod' | translate }}</div>
				} @else if (rangeIsInverted()) {
					<div class="empty">{{ 'Dashboard_InvalidRange' | translate }}</div>
				} @else if (chart().series.length === 0) {
					<div class="empty">{{ 'Sonar_NoDataInPeriod' | translate }}</div>
				} @else {
					<app-coverage-line-chart
						[labels]="chart().labels"
						[tooltipTitles]="chart().titles"
						[series]="chart().series"
						[spanGaps]="false" />
				}
			</section>
		}
	`
})
export class SonarcloudComponent implements OnInit {
	private readonly service = inject(SonarCoverageService);
	private readonly translator = inject(Translator);
	private readonly filters = inject(SonarcloudFiltersState);

	protected readonly paletteSize = PALETTE_SIZE;
	protected readonly projects = signal<SonarProject[]>([]);
	// The filters live in a service, so they are still there when the user leaves this page and comes back.
	protected readonly projectKeys = this.filters.projectKeys;
	protected readonly loading = signal(true);
	/** True while the history of newly selected projects is being read. */
	protected readonly busy = signal(false);
	protected readonly loadError = signal(false);
	/** The multi-select does not clear its chips by itself, so a new key renders the filters again. */
	protected readonly filtersKey = signal(0);
	protected readonly clearButton = new ButtonOptions({
		text: this.translator.t('Dashboard_Reset'),
		type: ButtonTypeEnum.Text,
		color: ButtonColorEnum.Grey
	});

	/** Stored months of every project read so far, by project key. */
	private readonly histories = signal<Record<string, MonthlyCoverage[]>>({});
	// The filters follow the data of the selected projects until the user types a value (an empty string means cleared).
	private readonly pickedFrom = this.filters.pickedFrom;
	private readonly pickedTo = this.filters.pickedTo;
	private readonly pickedMonth = this.filters.pickedMonth;

	/** First and last month (`YYYY-MM`) stored for the selected projects. */
	private readonly bounds = computed(() => {
		const months = this.projectKeys()
			.flatMap((key) => this.histories()[key] ?? [])
			.map((h) => h.month.slice(0, 7))
			.sort();
		return { first: months[0] ?? '', last: months.at(-1) ?? '' };
	});
	/** Period of the chart, as `YYYY-MM`. */
	protected readonly from = computed(() => this.pickedFrom() ?? this.bounds().first);
	protected readonly to = computed(() => this.pickedTo() ?? this.bounds().last);
	/** Month shown in the table; by default the latest one with data. */
	protected readonly month = computed(() => this.pickedMonth() ?? this.bounds().last);
	protected readonly rangeIsInverted = computed(() => this.from() > this.to());

	/** One row per selected project for exactly the chosen month; a month without a value is never replaced by another. */
	protected readonly rows = computed<TableRow[]>(() => {
		const month = monthStart(this.month());
		return this.projectKeys().map((key) => {
			const found = this.histories()[key]?.find((h) => h.month === month);
			return {
				key,
				name: this.nameOf(key),
				coverage: found?.coverage ?? null,
				measuredOn: found ? this.formatDay(found.measuredOn) : ''
			};
		});
	});

	/** Every month of the period is on the axis, so months without a measurement show as gaps. */
	protected readonly chart = computed<ChartView>(() => {
		if (!this.from() || !this.to() || this.rangeIsInverted()) {
			return EMPTY_CHART;
		}
		const months = monthRange(this.from(), this.to());
		const series: ChartSeries[] = this.projectKeys().map((key) => {
			const byMonth = new Map((this.histories()[key] ?? []).map((h) => [h.month.slice(0, 7), h.coverage]));
			return { name: this.nameOf(key), values: months.map((m) => byMonth.get(m) ?? null) };
		});
		if (!series.some((s) => s.values.some((v) => v !== null))) {
			return EMPTY_CHART;
		}
		const parts = months.map((m) => ({ year: m.slice(0, 4), month: Number(m.slice(5, 7)) }));
		return {
			labels: parts.map((p) => `${this.translator.monthShort(p.month)}/${p.year}`),
			titles: parts.map((p) => `${this.translator.monthName(p.month)} ${p.year}`),
			series
		};
	});

	constructor() {
		inject(ViewTitleService).setViewTitleMetadata({
			outlet: OutletEnum.Primary,
			title: this.translator.t('Title_SonarCloud')
		});
	}

	async ngOnInit(): Promise<void> {
		try {
			this.projects.set(await this.service.listProjects());
		} catch {
			this.loadError.set(true);
		} finally {
			this.loading.set(false);
		}
		// Coming back to the page with projects already selected: reads their history again.
		if (!this.loadError()) {
			await this.selectProjects(this.projectKeys());
		}
	}

	/** Empties every filter, which also empties the table and the chart. */
	protected clearFilters(): void {
		this.filters.reset();
		this.filtersKey.update((n) => n + 1);
	}

	/** Reads the history of the projects that were not read yet; the filters then follow the data. */
	protected async selectProjects(keys: string[] | null): Promise<void> {
		const selected = keys ?? [];
		this.projectKeys.set(selected);
		const missing = selected.filter((key) => !(key in this.histories()));
		if (missing.length === 0) {
			return;
		}
		this.busy.set(true);
		try {
			const loaded = await Promise.all(
				missing.map(async (key) => [key, await this.service.getHistory(key)] as const)
			);
			this.histories.update((all) => ({ ...all, ...Object.fromEntries(loaded) }));
		} catch {
			this.loadError.set(true);
		} finally {
			this.busy.set(false);
		}
	}

	/** The month input also emits partial text while typing; only complete months count. */
	protected setFrom(value: string | null): void {
		this.pickedFrom.set(this.validMonth(value));
	}

	protected setTo(value: string | null): void {
		this.pickedTo.set(this.validMonth(value));
	}

	protected setMonth(value: string | null): void {
		this.pickedMonth.set(this.validMonth(value));
	}

	private validMonth(value: string | null): string {
		return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : '';
	}

	private nameOf(key: string): string {
		return this.projects().find((p) => p.key === key)?.name ?? key;
	}

	/** `YYYY-MM-DD` as a date in the user's language. */
	private formatDay(day: string): string {
		const [year, month, date] = day.split('-').map(Number);
		return new Date(year, month - 1, date).toLocaleDateString(this.translator.locale);
	}
}
