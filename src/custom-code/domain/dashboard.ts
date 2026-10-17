import { CoverageEntry, formatPeriod, Team } from './models';

export interface ChartSeries {
	name: string;
	/** One value per label; null where the application has no entry for that month. */
	values: (number | null)[];
}

export interface ChartData {
	labels: string[];
	series: ChartSeries[];
}

/** Months as `YYYY-MM`, the value of the month input; an empty string leaves that end open. */
export interface MonthRange {
	from: string;
	to: string;
}

/** `YYYY-MM` as a sortable month number, or null when empty or invalid. */
const monthNumber = (value: string): number | null => {
	const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
	return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
};

/** Builds the monthly evolution; each selected application with entries becomes one line. No `applicationIds` means no chart. */
export const buildChartData = (
	entries: CoverageEntry[],
	team: Team | undefined,
	applicationIds: string[],
	testTypeKey: string,
	range: MonthRange = { from: '', to: '' }
): ChartData => {
	if (!team || !testTypeKey || applicationIds.length === 0) {
		return { labels: [], series: [] };
	}
	const from = monthNumber(range.from);
	const to = monthNumber(range.to);
	const applications = team.applications.filter(
		(a) => applicationIds.includes(a.id) && a.testTypeKeys.includes(testTypeKey)
	);
	const relevant = entries.filter((e) => {
		const month = e.year * 12 + (e.month - 1);
		return (
			e.teamId === team.id &&
			e.testTypeKey === testTypeKey &&
			applications.some((a) => a.id === e.applicationId) &&
			(from === null || month >= from) &&
			(to === null || month <= to)
		);
	});
	// Months become a single sortable number so periods can span several years.
	const periods = [...new Set(relevant.map((e) => e.year * 12 + (e.month - 1)))].sort((a, b) => a - b);

	const series = applications
		.map((a) => ({
			name: a.name,
			values: periods.map(
				(p) =>
					relevant.find((e) => e.applicationId === a.id && e.year * 12 + (e.month - 1) === p)?.percent ?? null
			)
		}))
		.filter((s) => s.values.some((v) => v !== null));

	return { labels: periods.map((p) => formatPeriod(Math.floor(p / 12), (p % 12) + 1)), series };
};
