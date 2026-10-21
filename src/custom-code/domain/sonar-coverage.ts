// Shared by the app and by the Node sync job (scripts/sonar-sync), which runs it with type stripping:
// keep this file free of imports and of TypeScript-only runtime syntax (enums, parameter properties).

/** One point of the coverage history returned by SonarCloud (`date` is an ISO timestamp with offset). */
export interface SonarHistoryPoint {
	date: string;
	value?: string;
}

/** The last coverage measured in a month, as stored in `sonar_coverage_monthly`. */
export interface MonthlyCoverage {
	/** First day of the month, `YYYY-MM-01`. */
	month: string;
	coverage: number;
	/** Day of the measurement, `YYYY-MM-DD`. */
	measuredOn: string;
}

/** `YYYY-MM` (month input) to `YYYY-MM-01`. */
export const monthStart = (yearMonth: string): string => `${yearMonth}-01`;

/**
 * Keeps, for each month, only the measurement with the latest date.
 * Months without a measurement are left out: they are never filled with values of other months.
 * Points without a value (analyses that did not compute coverage) are not measurements and are ignored.
 */
export const lastValuePerMonth = (history: SonarHistoryPoint[]): MonthlyCoverage[] => {
	const latest = new Map<string, { time: number; point: SonarHistoryPoint }>();
	for (const point of history) {
		const coverage = Number(point.value);
		const time = Date.parse(point.date);
		if (point.value === undefined || point.value === '' || !Number.isFinite(coverage) || Number.isNaN(time)) {
			continue;
		}
		// The month is read from the text, so it is the day SonarCloud shows (not shifted by the time zone).
		const month = monthStart(point.date.slice(0, 7));
		const current = latest.get(month);
		if (!current || time > current.time) {
			latest.set(month, { time, point });
		}
	}
	return [...latest.entries()]
		.map(([month, { point }]) => ({
			month,
			coverage: Number(point.value),
			measuredOn: point.date.slice(0, 10)
		}))
		.sort((a, b) => a.month.localeCompare(b.month));
};

/** Every month (`YYYY-MM`) from `from` to `to`, both included; empty when `from` is after `to`. */
export const monthRange = (from: string, to: string): string[] => {
	const index = (yearMonth: string): number => Number(yearMonth.slice(0, 4)) * 12 + Number(yearMonth.slice(5, 7)) - 1;
	const months: string[] = [];
	for (let i = index(from); i <= index(to); i++) {
		months.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
	}
	return months;
};

/**
 * Short label for a project: what follows the first dot ("acme_product-tech.usg.server" -> "usg.server"),
 * or what follows the first underscore when there is no dot.
 */
export const shortProjectName = (name: string): string => {
	const dot = name.indexOf('.');
	const start = dot >= 0 ? dot : name.indexOf('_');
	return name.slice(start + 1) || name;
};

/** Short names, except where two projects would end up with the same one: those keep their full name. */
export const shortProjectNames = (names: string[]): string[] => {
	const shorts = names.map(shortProjectName);
	return shorts.map((short, i) => (shorts.indexOf(short) === shorts.lastIndexOf(short) ? short : names[i]));
};
