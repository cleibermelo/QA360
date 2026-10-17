import { buildChartData } from './dashboard';
import { CoverageEntry } from './models';
import { SEED_TEAMS } from './seed';

const team = SEED_TEAMS[0];

const entry = (
	applicationId: string,
	year: number,
	month: number,
	percent: number,
	testTypeKey = 'unit'
): CoverageEntry => ({
	teamId: 'toct',
	applicationId,
	testTypeKey,
	year,
	month,
	percent,
	note: '',
	updatedAt: '2026-10-01T00:00:00Z',
	history: []
});

describe('buildChartData', () => {
	it('returns nothing when there are no entries', () => {
		expect(buildChartData([], team, ['apis'], 'unit')).toEqual({ labels: [], series: [] });
	});

	it('returns nothing until an application is selected', () => {
		expect(buildChartData([entry('apis', 2026, 1, 50)], team, [], 'unit')).toEqual({ labels: [], series: [] });
	});

	it('sorts months chronologically across years', () => {
		const data = buildChartData([entry('apis', 2026, 1, 50), entry('apis', 2025, 12, 40)], team, ['apis'], 'unit');
		expect(data.labels).toEqual(['12/2025', '01/2026']);
		expect(data.series).toEqual([{ name: 'APIs', values: [40, 50] }]);
	});

	it('compares the selected applications, leaving gaps as null', () => {
		const data = buildChartData(
			[entry('apis', 2026, 1, 50), entry('apis', 2026, 2, 60), entry('srs', 2026, 2, 30)],
			team,
			['apis', 'srs'],
			'unit'
		);
		expect(data.series).toEqual([
			{ name: 'APIs', values: [50, 60] },
			{ name: 'SRS', values: [null, 30] }
		]);
	});

	it('compares only the selected applications', () => {
		const entries = [entry('apis', 2026, 1, 50), entry('srs', 2026, 1, 30), entry('usage', 2026, 1, 70)];
		const data = buildChartData(entries, team, ['apis', 'usage'], 'unit');
		expect(data.series.map((s) => s.name)).toEqual(['APIs', 'Usage']);
	});

	it('filters by test type and by the selected application', () => {
		const entries = [
			entry('apis', 2026, 1, 50),
			entry('apis', 2026, 1, 90, 'integration'),
			entry('srs', 2026, 1, 30)
		];
		expect(buildChartData(entries, team, ['apis'], 'integration').series).toEqual([{ name: 'APIs', values: [90] }]);
	});

	describe('month range', () => {
		const entries = [1, 2, 3, 4, 5, 6].map((m) => entry('apis', 2026, m, m * 10));

		it('keeps only the months between from and to, both included', () => {
			const data = buildChartData(entries, team, ['apis'], 'unit', { from: '2026-02', to: '2026-04' });
			expect(data.labels).toEqual(['02/2026', '03/2026', '04/2026']);
			expect(data.series[0].values).toEqual([20, 30, 40]);
		});

		it('treats an empty end as open', () => {
			expect(buildChartData(entries, team, ['apis'], 'unit', { from: '2026-05', to: '' }).labels).toEqual([
				'05/2026',
				'06/2026'
			]);
			expect(buildChartData(entries, team, ['apis'], 'unit', { from: '', to: '2026-02' }).labels).toEqual([
				'01/2026',
				'02/2026'
			]);
		});

		it('works across years and ignores a value that is not a month', () => {
			const across = [entry('apis', 2025, 12, 40), entry('apis', 2026, 1, 50), entry('apis', 2026, 2, 60)];
			expect(buildChartData(across, team, ['apis'], 'unit', { from: '2025-12', to: '2026-01' }).labels).toEqual([
				'12/2025',
				'01/2026'
			]);
			expect(buildChartData(across, team, ['apis'], 'unit', { from: 'abc', to: '' }).labels.length).toBe(3);
		});

		it('returns nothing when from is after to', () => {
			const data = buildChartData(entries, team, ['apis'], 'unit', { from: '2026-05', to: '2026-02' });
			expect(data.series).toEqual([]);
		});
	});
});
