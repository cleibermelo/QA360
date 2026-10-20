import { lastValuePerMonth, monthRange, monthStart, shortProjectName, shortProjectNames } from './sonar-coverage';

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

describe('monthRange', () => {
	it('lists every month of the interval, crossing years', () => {
		expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
		expect(monthRange('2026-01', '2026-08')).toHaveSize(8);
	});

	it('returns one month when the ends are equal and nothing when the interval is inverted', () => {
		expect(monthRange('2026-03', '2026-03')).toEqual(['2026-03']);
		expect(monthRange('2026-04', '2026-03')).toEqual([]);
	});
});

describe('shortProjectName', () => {
	it('keeps what follows the first dot, or the first underscore when there is no dot', () => {
		expect(shortProjectName('iberia_lithium-product-tech.usg.server')).toBe('usg.server');
		expect(shortProjectName('iberia_ekon-product-ac')).toBe('ekon-product-ac');
		expect(shortProjectName('plain')).toBe('plain');
		expect(shortProjectName('odd.')).toBe('odd.');
	});

	it('keeps the full name of projects whose short names would be equal', () => {
		expect(
			shortProjectNames([
				'iberia_lithium-product-tech.srs.server',
				'iberia_lithium-product-core.srs.server',
				'iberia_lithium-product-tech.usg.server'
			])
		).toEqual(['iberia_lithium-product-tech.srs.server', 'iberia_lithium-product-core.srs.server', 'usg.server']);
	});
});
