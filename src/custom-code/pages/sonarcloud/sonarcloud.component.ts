import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { MonthInputComponent, SingleSelectComponent } from '@polygon/components';
import { OutletEnum, ViewTitleService } from '@polygon/core';
import { CoverageLineChartComponent } from '../../components/coverage-line-chart/coverage-line-chart.component';
import { SonarCoverageService, SonarProject } from '../../data/sonar-coverage.service';
import { ChartData } from '../../domain/dashboard';
import { formatPeriod } from '../../domain/models';
import { MonthlyCoverage, monthStart } from '../../domain/sonar-coverage';
import { TranslatePipe } from '../../shared/translate.pipe';
import { Translator } from '../../shared/translator.service';

const EMPTY_CHART: ChartData = { labels: [], series: [] };

/** Coverage that the daily job copies from SonarCloud: a project and month picker, the value card and the history chart. */
@Component({
	selector: 'app-sonarcloud',
	imports: [SingleSelectComponent, MonthInputComponent, CoverageLineChartComponent, TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrl: '../page.scss',
	styles: `
		.project-field {
			width: 420px;
		}
		.project-field po-single-select {
			width: 100%;
		}
		.card {
			display: flex;
			flex-wrap: wrap;
			gap: 32px;
			align-items: baseline;
		}
		.card .name {
			flex: 1 1 100%;
			font-weight: 500;
			color: var(--grey-9);
			overflow-wrap: anywhere;
		}
		.card .value {
			font-size: 40px;
			font-weight: 500;
			color: var(--grey-9);
			font-variant-numeric: tabular-nums;
		}
		.card .caption {
			display: block;
			font-size: 12px;
			color: var(--grey-8);
		}
		@media (max-width: 600px) {
			.project-field {
				width: 100%;
			}
		}
	`,
	template: `
		<section class="page-section">
			<div class="filters">
				<div class="field project-field">
					<span class="label">{{ 'Sonar_Project' | translate }}</span>
					<po-single-select
						[defaultData]="{ data: projects() }"
						valueKey="key"
						labelKey="name"
						[placeholder]="'Sonar_ProjectPlaceholder' | translate"
						[ariaLabel]="'Sonar_Project' | translate"
						[selectedValue]="projectKey()"
						(selectedValueChange)="selectProject($any($event))" />
				</div>
				<div class="field">
					<span class="label">{{ 'Sonar_Month' | translate }}</span>
					<po-month-input
						[value]="month()"
						(valueChange)="setMonth($event)"
						[ariaLabel]="'Sonar_Month' | translate" />
				</div>
			</div>
		</section>

		<section class="page-section">
			@if (loadError()) {
				<div class="empty">{{ 'Error_Load' | translate }}</div>
			} @else if (loading()) {
				<div class="empty">{{ 'Sonar_Loading' | translate }}</div>
			} @else if (projects().length === 0) {
				<div class="empty">{{ 'Sonar_NoData' | translate }}</div>
			} @else if (!projectKey()) {
				<div class="empty">{{ 'Sonar_SelectProject' | translate }}</div>
			} @else if (!month()) {
				<div class="empty">{{ 'Sonar_SelectMonth' | translate }}</div>
			} @else if (current(); as row) {
				<div class="card">
					<span class="name">{{ projectName() }}</span>
					<span>
						<span class="value">{{ row.coverage }}%</span>
						<span class="caption">{{ 'Sonar_Coverage' | translate }}</span>
					</span>
					<span>
						<span class="value">{{ measuredOn() }}</span>
						<span class="caption">{{ 'Sonar_MeasuredOn' | translate }}</span>
					</span>
				</div>
			} @else {
				<div class="empty">{{ 'Sonar_NoMeasurement' | translate }}</div>
			}
		</section>

		@if (chart().series.length > 0) {
			<section class="page-section">
				<h3>{{ 'Sonar_History' | translate }}</h3>
				<app-coverage-line-chart [labels]="chart().labels" [series]="chart().series" />
			</section>
		}
	`
})
export class SonarcloudComponent implements OnInit {
	private readonly service = inject(SonarCoverageService);
	private readonly translator = inject(Translator);

	protected readonly projects = signal<SonarProject[]>([]);
	protected readonly projectKey = signal('');
	/** `YYYY-MM` as the month input emits it; the query uses the first day of that month. */
	protected readonly month = signal('');
	protected readonly history = signal<MonthlyCoverage[]>([]);
	protected readonly current = signal<MonthlyCoverage | null>(null);
	protected readonly loading = signal(true);
	protected readonly loadError = signal(false);

	protected readonly projectName = computed(
		() => this.projects().find((p) => p.key === this.projectKey())?.name ?? this.projectKey()
	);
	protected readonly measuredOn = computed(() => {
		const day = this.current()?.measuredOn;
		if (!day) {
			return '';
		}
		const [year, month, date] = day.split('-').map(Number);
		return new Date(year, month - 1, date).toLocaleDateString(this.translator.locale);
	});
	protected readonly chart = computed<ChartData>(() => {
		const history = this.history();
		if (history.length === 0) {
			return EMPTY_CHART;
		}
		return {
			labels: history.map((h) => formatPeriod(Number(h.month.slice(0, 4)), Number(h.month.slice(5, 7)))),
			series: [{ name: this.projectName(), values: history.map((h) => h.coverage) }]
		};
	});

	/** Drops answers of requests that were overtaken by a newer choice. */
	private requestId = 0;

	constructor() {
		inject(ViewTitleService).setViewTitleMetadata({
			outlet: OutletEnum.Primary,
			title: this.translator.t('Title_SonarCloud')
		});
		// The card always shows the exact month asked for; with no stored value it says so.
		effect(() => {
			const key = this.projectKey();
			const month = this.month();
			untracked(() => void this.loadMonth(key, month));
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
	}

	/** Picking a project opens it on its latest stored month, so the card is not empty by accident. */
	protected async selectProject(key: string): Promise<void> {
		this.projectKey.set(key);
		this.history.set([]);
		if (!key) {
			return;
		}
		try {
			const history = await this.service.getHistory(key);
			if (this.projectKey() !== key) {
				return;
			}
			this.history.set(history);
			const latest = history.at(-1);
			if (latest) {
				this.month.set(latest.month.slice(0, 7));
			}
		} catch {
			this.loadError.set(true);
		}
	}

	/** The month input also emits partial text while typing; only complete months count. */
	protected setMonth(value: string | null): void {
		this.month.set(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : '');
	}

	private async loadMonth(key: string, month: string): Promise<void> {
		const id = ++this.requestId;
		if (!key || !month) {
			this.current.set(null);
			return;
		}
		try {
			const row = await this.service.getMonth(key, monthStart(month));
			if (id === this.requestId) {
				this.current.set(row);
			}
		} catch {
			if (id === this.requestId) {
				this.loadError.set(true);
			}
		}
	}
}
