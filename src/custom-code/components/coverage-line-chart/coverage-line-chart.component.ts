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
import { Chart, ChartOptions, Plugin, registerables } from 'chart.js';
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
	/** Joins the points across months without a value; turn off to show those months as gaps. */
	readonly spanGaps = input(true);
	/** Optional longer text for each label, used as the tooltip title. */
	readonly tooltipTitles = input<string[]>();
	/** Lighter look: no vertical grid, faint horizontal lines, small points and one tooltip with every series of the month. */
	readonly clean = input(false);

	protected readonly translator = inject(Translator);

	private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
	private chart?: Chart;

	constructor() {
		// Rebuilds the chart whenever labels, series or unit change.
		effect(() => {
			const labels = this.labels();
			const series = this.series();
			const unit = this.unit();
			const spanGaps = this.spanGaps();
			const titles = this.tooltipTitles();
			const clean = this.clean();
			const style = getComputedStyle(this.canvas().nativeElement);
			// Reads the theme token at draw time; falls back to a fixed blue if the token is missing.
			const color = (i: number): string =>
				style.getPropertyValue(SERIES_COLORS[i % SERIES_COLORS.length]).trim() || '#1c4eb7';
			const token = (name: string, fallback: string): string => style.getPropertyValue(name).trim() || fallback;
			const gridColor = token('--grey-3', '#eceef1');
			const textColor = token('--grey-8', '#6b7280');
			const datasets = series.map((s, i) => ({
				label: s.name,
				data: s.values,
				borderColor: color(i),
				backgroundColor: color(i),
				tension: 0.2,
				// Months without an entry do not break the line, unless the caller wants the gaps shown.
				spanGaps,
				...(clean ? { borderWidth: 2, pointRadius: 2, pointHoverRadius: 5 } : {})
			}));

			const options: ChartOptions<'line'> = {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						min: 0,
						max: 100,
						title: { display: !clean, text: unit },
						ticks: { callback: (v) => `${v}%`, ...(clean ? { stepSize: 25, color: textColor } : {}) },
						...(clean ? { grid: { color: gridColor, drawTicks: false }, border: { display: false } } : {})
					},
					...(clean
						? { x: { grid: { display: false }, border: { display: false }, ticks: { color: textColor } } }
						: {})
				},
				...(clean ? { interaction: { mode: 'index' as const, intersect: false } } : {}),
				plugins: {
					...(clean
						? { legend: { labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: textColor } } }
						: {}),
					tooltip: {
						// With gaps shown, series without a value in the month stay out of the tooltip.
						...(clean ? { filter: (item) => item.parsed.y !== null } : {}),
						callbacks: {
							title: (items) => titles?.[items[0].dataIndex] ?? items[0].label,
							label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`
						}
					}
				}
			};

			// A thin vertical guide at the hovered month, only while the tooltip is open.
			const hoverLine: Plugin<'line'> = {
				id: 'hoverLine',
				afterDatasetsDraw: (chart) => {
					const active = chart.tooltip?.getActiveElements();
					if (!active?.length) {
						return;
					}
					const { top, bottom } = chart.chartArea;
					const ctx = chart.ctx;
					ctx.save();
					ctx.beginPath();
					ctx.moveTo(active[0].element.x, top);
					ctx.lineTo(active[0].element.x, bottom);
					ctx.lineWidth = 1;
					ctx.strokeStyle = gridColor;
					ctx.stroke();
					ctx.restore();
				}
			};

			this.chart?.destroy();
			this.chart = new Chart(this.canvas().nativeElement, {
				type: 'line',
				data: { labels, datasets },
				options,
				plugins: clean ? [hoverLine] : []
			});
		});
	}

	ngOnDestroy(): void {
		this.chart?.destroy();
	}
}
