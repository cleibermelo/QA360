import { lastValuePerMonth, monthStart } from './sonar-coverage';

describe('lastValuePerMonth', () => {
	it('keeps only the latest measurement of each month', () => {
		const result = lastValuePerMonth([
			{ date: '2026-02-27T10:00:00+0000', value: '33.8' },
			{ date: '2026-02-10T10:00:00+0000', value: '30.1' },
			{ date: '2026-01-15T09:00:00+0000', value: '28' }
		]);
		expect(result).toEqual([
			{ month: '2026-01-01', coverage: 28, measuredOn: '2026-01-15' },
			{ month: '2026-02-01', coverage: 33.8, measuredOn: '2026-02-27' }
		]);
	});

	it('does not fill months without a measurement', () => {
		const result = lastValuePerMonth([
			{ date: '2026-01-31T10:00:00+0000', value: '10' },
			{ date: '2026-03-02T10:00:00+0000', value: '12' }
		]);
		expect(result.map((r) => r.month)).toEqual(['2026-01-01', '2026-03-01']);
	});

	it('compares by instant, so the order of the input does not matter', () => {
		const result = lastValuePerMonth([
			{ date: '2026-02-27T08:00:00+0100', value: '50' },
			{ date: '2026-02-27T09:00:00+0100', value: '60' }
		]);
		expect(result).toEqual([{ month: '2026-02-01', coverage: 60, measuredOn: '2026-02-27' }]);
	});

	it('ignores points without a value and returns nothing for an empty history', () => {
		expect(lastValuePerMonth([])).toEqual([]);
		expect(
			lastValuePerMonth([
				{ date: '2026-02-27T10:00:00+0000' },
				{ date: '2026-02-20T10:00:00+0000', value: '41.5' }
			])
		).toEqual([{ month: '2026-02-01', coverage: 41.5, measuredOn: '2026-02-20' }]);
	});

	it('turns a year-month into the first day of the month', () => {
		expect(monthStart('2026-02')).toBe('2026-02-01');
	});
});
