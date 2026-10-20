import { Team, TestType } from './models';

/** Managed list of test types; names and units live in the i18n files (TestType_<key>_Name / _Unit). */
export const SEED_TEST_TYPES: TestType[] = [
	{ key: 'unit', active: true },
	{ key: 'integration', active: true },
	{ key: 'api', active: true },
	{ key: 'ui', active: true },
	{ key: 'performance', active: false }
];

/** Initial data: only the TOCT team and its four applications, no coverage entries. */
export const SEED_TEAMS: Team[] = [
	{
		id: 'toct',
		name: 'TOCT',
		ownerName: '',
		applications: [
			{ id: 'apis', name: 'APIs', testTypeKeys: ['unit', 'integration', 'api'] },
			{ id: 'usage', name: 'Usage', testTypeKeys: ['unit', 'integration'] },
			{ id: 'srs', name: 'SRS', testTypeKeys: ['unit', 'integration'] },
			{ id: 'cbms', name: 'CBMS', testTypeKeys: ['unit', 'integration'] }
		]
	}
];
