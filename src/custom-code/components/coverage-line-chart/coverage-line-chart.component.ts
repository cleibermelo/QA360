import {
	ChangeDetectionStrategy,
	Component,
	effect,
	ElementRef,
	inject,
	input,
	OnDestroy,
	viewChild
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { ChartSeries } from '../../domain/dashboard';
import { Translator } from '../../shared/translator.service';

Chart.register(...registerables);

/** Polygon theme tokens used as line colors, in order. */
const SERIES_COLORS = ['--chart-1', '--secondary-80', '--success-80', '--chart-11', '--info-80', '--grey-6'];

/**
 * Line chart for the monthly coverage evolution.
 * Polygon only offers a chart widget driven by HTTP-configured dashboards, so this is a thin wrapper over
 * the chart.js library that Polygon already ships with.
 */
@Component({
	selector: 'app-coverage-line-chart',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: block;
			position: relative;
			height: 360px;
		}
		@media (max-width: 600px) {
			:host {
				height: 280px;
			}
		}
	`,
	template: `<canvas #canvas role="img" [attr.aria-label]="translator.t('Chart_AriaLabel')"></canvas>`
})
export class CoverageLineChartComponent implements OnDestroy {
	readonly labels = input.required<string[]>();
	readonly series = input.required<ChartSeries[]>();
	readonly unit = input('%');

	protected readonly translator = inject(Translator);

	private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
	private chart?: Chart;

	constructor() {
		// Rebuilds the chart whenever labels, series or unit change.
		effect(() => {
			const labels = this.labels();
			const series = this.series();
			const unit = this.unit();
			const style = getComputedStyle(this.canvas().nativeElement);
			// Reads the theme token at draw time; falls back to a fixed blue if the token is missing.
			const color = (i: number): string =>
				style.getPropertyValue(SERIES_COLORS[i % SERIES_COLORS.length]).trim() || '#1c4eb7';
			const datasets = series.map((s, i) => ({
				label: s.name,
				data: s.values,
				borderColor: color(i),
				backgroundColor: color(i),
				tension: 0.2,
				// Months without an entry do not break the line.
				spanGaps: true
			}));

			this.chart?.destroy();
			this.chart = new Chart(this.canvas().nativeElement, {
				type: 'line',
				data: { labels, datasets },
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						y: {
							min: 0,
							max: 100,
							title: { display: true, text: unit },
							ticks: { callback: (v) => `${v}%` }
						}
					},
					plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%` } } }
				}
			});
		});
	}

	ngOnDestroy(): void {
		this.chart?.destroy();
	}
}
