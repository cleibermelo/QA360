import { CoverageEntry, CoverageInput, Team } from './models';
import {
	findApplicationOwner,
	findEntry,
	upsertEntry,
	validateApplicationName,
	validateApplicationTestTypes,
	validateEntryTestType,
	validatePercent,
	validateTeamApplications,
	validateTeamName
} from './rules';
import { SEED_TEAMS, SEED_TEST_TYPES } from './seed';

const apis = SEED_TEAMS[0].applications[0];

/** A valid input for TOCT/APIs/unit in September 2026; tests override what they need. */
const input = (overrides: Partial<CoverageInput> = {}): CoverageInput => ({
	teamId: 'toct',
	applicationId: 'apis',
	testTypeKey: 'unit',
	year: 2026,
	month: 9,
	percent: 70,
	note: '',
	...overrides
});

describe('registration validations', () => {
	const teams: Team[] = SEED_TEAMS;

	it('requires a team name and rejects duplicates regardless of case', () => {
		expect(validateTeamName('  ', teams)).toBeTruthy();
		expect(validateTeamName('toct', teams)).toBeTruthy();
		expect(validateTeamName('Other', teams)).toBeNull();
		expect(validateTeamName('TOCT', teams, 'toct')).toBeNull();
	});

	it('requires an application name that is unique within the team', () => {
		const applications = teams[0].applications;
		expect(validateApplicationName('', applications)).toBeTruthy();
		expect(validateApplicationName(' srs ', applications)).toBeTruthy();
		expect(validateApplicationName('New', applications)).toBeNull();
		expect(validateApplicationName('SRS', applications, 'srs')).toBeNull();
	});

	it('does not allow an application name that already belongs to another team', () => {
		expect(findApplicationOwner(' srs ', teams)?.id).toBe('toct');
		expect(findApplicationOwner('SRS', teams, 'other')?.id).toBe('toct');
		expect(findApplicationOwner('SRS', teams, 'toct')).toBeUndefined();
		expect(findApplicationOwner('New', teams)).toBeUndefined();
	});

	it('requires at least one application on a team', () => {
		expect(validateTeamApplications([])).toBeTruthy();
		expect(validateTeamApplications(teams[0].applications)).toBeNull();
	});

	it('requires at least one test type on an application', () => {
		expect(validateApplicationTestTypes([])).toBeTruthy();
		expect(validateApplicationTestTypes(['unit'])).toBeNull();
	});
});

describe('percent validation', () => {
	it('accepts 0 to 100 with up to two decimal places', () => {
		[0, 100, 55.5, 33.33].forEach((v) => expect(validatePercent(v)).toBeNull());
	});

	it('rejects empty, out of range and more than two decimal places', () => {
		[null, undefined, NaN, -0.01, 100.01, 10.123].forEach((v) => expect(validatePercent(v)).toBeTruthy());
	});
});

describe('test type of an entry', () => {
	it('blocks a test type not enabled on the application', () => {
		expect(validateEntryTestType(apis, 'ui', SEED_TEST_TYPES)).toBeTruthy();
	});

	it('blocks an inactive test type even if it is enabled', () => {
		const application = { ...apis, testTypeKeys: [...apis.testTypeKeys, 'performance'] };
		expect(validateEntryTestType(application, 'performance', SEED_TEST_TYPES)).toBeTruthy();
	});

	it('accepts an active and enabled test type', () => {
		expect(validateEntryTestType(apis, 'unit', SEED_TEST_TYPES)).toBeNull();
	});
});

describe('upsertEntry and history', () => {
	const t1 = new Date('2026-10-01T10:00:00Z');
	const t2 = new Date('2026-10-05T10:00:00Z');

	it('creates the first entry without history', () => {
		const { entries, outcome } = upsertEntry([], input(), t1);
		expect(outcome).toBe('created');
		expect(entries.length).toBe(1);
		expect(entries[0].history).toEqual([]);
	});

	it('keeps a single current value and records the date and previous value when updating', () => {
		const first = upsertEntry([], input({ percent: 70, note: 'initial' }), t1).entries;
		const { entries, outcome } = upsertEntry(first, input({ percent: 75 }), t2);

		expect(outcome).toBe('updated');
		expect(entries.length).toBe(1);
		expect(entries[0].percent).toBe(75);
		expect(entries[0].history).toEqual([
			{ changedAt: t2.toISOString(), previousPercent: 70, previousNote: 'initial' }
		]);
	});

	it('accumulates history on every change', () => {
		let entries: CoverageEntry[] = upsertEntry([], input({ percent: 10 }), t1).entries;
		entries = upsertEntry(entries, input({ percent: 20 }), t2).entries;
		entries = upsertEntry(entries, input({ percent: 30 }), new Date('2026-10-06T10:00:00Z')).entries;
		expect(entries[0].history.map((h) => h.previousPercent)).toEqual([10, 20]);
	});

	it('does not change anything nor add history when value and note are the same', () => {
		const first = upsertEntry([], input(), t1).entries;
		const { entries, outcome } = upsertEntry(first, input(), t2);
		expect(outcome).toBe('unchanged');
		expect(entries).toBe(first);
	});

	it('keeps entries apart per application, test type and month', () => {
		let entries = upsertEntry([], input(), t1).entries;
		entries = upsertEntry(entries, input({ month: 10 }), t1).entries;
		entries = upsertEntry(entries, input({ testTypeKey: 'integration' }), t1).entries;
		entries = upsertEntry(entries, input({ applicationId: 'usage' }), t1).entries;
		expect(entries.length).toBe(4);
		expect(findEntry(entries, input({ month: 10 }))?.month).toBe(10);
	});
});
