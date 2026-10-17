import { TestBed } from '@angular/core/testing';
import { CoverageRepository, RepositoryError } from './coverage.repository';
import { CoverageStore } from './coverage.store';
import { InMemoryCoverageRepository } from './in-memory-coverage.repository';

const entryOf = (applicationId: string, percent: number, month = 9) => ({
	teamId: 'toct',
	applicationId,
	testTypeKey: 'unit',
	year: 2026,
	month,
	percent,
	note: ''
});

describe('CoverageStore', () => {
	let store: CoverageStore;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			providers: [{ provide: CoverageRepository, useClass: InMemoryCoverageRepository }]
		});
		// A fresh store per test: TestBed creates a new root injector each time.
		store = TestBed.inject(CoverageStore);
		await store.loaded;
	});

	it('loads the TOCT team and its four applications, without entries and without a selected team', () => {
		expect(store.loading()).toBeFalse();
		expect(store.teams().map((t) => t.name)).toEqual(['TOCT']);
		expect(store.teams()[0].applications.map((a) => a.name)).toEqual(['APIs', 'Usage', 'SRS', 'CBMS']);
		expect(store.entries()).toEqual([]);
		expect(store.selectedTeamId()).toBe('');
	});

	it('does not offer inactive test types for registration or entries', () => {
		expect(store.activeTestTypes().map((t) => t.key)).toEqual(['unit', 'integration', 'api', 'ui']);
	});

	it('rejects a duplicate team, an application without test types and a repeated application name', async () => {
		const apis = { id: 'apis', name: 'APIs', testTypeKeys: ['unit'] };
		expect((await store.saveTeam({ name: 'toct', applications: [] })).error).toBeTruthy();
		expect(
			(await store.saveTeam({ name: 'Other', applications: [{ name: 'New', testTypeKeys: [] }] })).error
		).toBeTruthy();
		expect(
			(
				await store.saveTeam({
					name: 'Other',
					applications: [apis, { name: ' apis ', testTypeKeys: ['unit'] }]
				})
			).error
		).toBeTruthy();
		expect(store.teams().length).toBe(1);
	});

	it('rejects an application that already belongs to another team, naming that team', async () => {
		const result = await store.saveTeam({
			name: 'Other',
			applications: [{ name: ' srs ', testTypeKeys: ['unit'] }]
		});

		expect(result.error).toBe('Validation_ApplicationInOtherTeam');
		expect(result.errorParams).toEqual({ index: 1 });
		expect(result.messageParams).toEqual({ name: 'srs', team: 'TOCT' });
		expect(store.teams().length).toBe(1);
	});

	it('rejects an application name taken by another team when editing a team', async () => {
		const other = await store.saveTeam({ name: 'Other', applications: [{ name: 'Core', testTypeKeys: ['unit'] }] });
		const applications = [...store.getTeam(other.value.id).applications, { name: 'APIs', testTypeKeys: ['unit'] }];
		const result = await store.saveTeam({ teamId: other.value.id, name: 'Other', applications });

		expect(result.error).toBe('Validation_ApplicationInOtherTeam');
		expect(store.getTeam(other.value.id).applications.length).toBe(1);
	});

	it('rejects a team without applications, when creating and when removing the last one', async () => {
		expect((await store.saveTeam({ name: 'Other', applications: [] })).error).toBe(
			'Validation_TeamApplicationRequired'
		);
		expect((await store.saveTeam({ teamId: 'toct', name: 'TOCT', applications: [] })).error).toBe(
			'Validation_TeamApplicationRequired'
		);
		expect(store.teams().length).toBe(1);
		expect(store.getTeam('toct').applications.length).toBe(4);
	});

	it('rejects an entry for a test type not enabled on the application', async () => {
		const result = await store.saveEntry({ ...entryOf('usage', 50), testTypeKey: 'api' });
		expect(result.error).toBeTruthy();
		expect(store.entries().length).toBe(0);
	});

	it('updates the same month and keeps the previous value in the history', async () => {
		await store.saveEntry(entryOf('apis', 60));
		const result = await store.saveEntry(entryOf('apis', 65.5));

		expect(result.value).toBe('updated');
		expect(store.entries().length).toBe(1);
		expect(store.entries()[0].percent).toBe(65.5);
		expect(store.entries()[0].history[0].previousPercent).toBe(60);
	});

	it('does not touch the history when the same value is saved again', async () => {
		await store.saveEntry(entryOf('apis', 60));
		const result = await store.saveEntry(entryOf('apis', 60));

		expect(result.value).toBe('unchanged');
		expect(store.entries()[0].history).toEqual([]);
	});

	it('saves several entries at once and counts what was created, updated and left as it was', async () => {
		await store.saveEntry(entryOf('apis', 60));
		await store.saveEntry(entryOf('usage', 30));

		const result = await store.saveEntries([entryOf('apis', 65), entryOf('usage', 30), entryOf('srs', 80)]);

		expect(result.value).toEqual({ created: 1, updated: 1, unchanged: 1 });
		expect(store.entries().length).toBe(3);
		expect(store.entries().find((e) => e.applicationId === 'apis').history[0].previousPercent).toBe(60);
	});

	it('saves nothing when one entry of the batch is invalid, naming its position', async () => {
		const result = await store.saveEntries([entryOf('apis', 60), entryOf('srs', 150)]);

		expect(result.error).toBe('Validation_PercentRange');
		expect(result.errorParams).toEqual({ index: 2 });
		expect(store.entries().length).toBe(0);
	});

	it('rejects the same application and test type twice in one batch', async () => {
		const result = await store.saveEntries([entryOf('apis', 60), entryOf('apis', 70)]);

		expect(result.error).toBe('Validation_RecordDuplicateRow');
		expect(result.errorParams).toEqual({ index: 2 });
		expect(store.entries().length).toBe(0);
	});

	it('deletes only the chosen entry', async () => {
		await store.saveEntry(entryOf('apis', 60));
		await store.saveEntry(entryOf('apis', 70, 10));
		await store.removeEntry(store.entries()[0]);

		expect(store.entries().map((e) => e.month)).toEqual([10]);
	});

	it('deletes the entries of an application removed from the team', async () => {
		await store.saveEntry(entryOf('cbms', 10));
		const kept = store.getTeam('toct').applications.filter((a) => a.id !== 'cbms');
		expect((await store.saveTeam({ teamId: 'toct', name: 'TOCT', applications: kept })).error).toBeUndefined();
		expect(store.entries().length).toBe(0);
	});

	it('edits the team keeping ids and entries of the applications that stay', async () => {
		await store.saveEntry(entryOf('apis', 10));
		const applications = [...store.getTeam('toct').applications, { name: 'New', testTypeKeys: ['unit'] }];
		const result = await store.saveTeam({ teamId: 'toct', name: 'TOCT Platform', applications });

		expect(result.value.id).toBe('toct');
		expect(store.getTeam('toct').name).toBe('TOCT Platform');
		const ids = store.getTeam('toct').applications.map((a) => a.id);
		expect(ids.slice(0, 4)).toEqual(['apis', 'usage', 'srs', 'cbms']);
		expect(ids.length).toBe(5);
		expect(store.entries().length).toBe(1);
	});

	it('creates a new team with applications and rejects an empty name when editing', async () => {
		const created = await store.saveTeam({
			name: 'Other',
			applications: [{ name: 'Core', testTypeKeys: ['unit'] }]
		});
		expect(store.getTeam(created.value.id).applications.map((a) => a.name)).toEqual(['Core']);
		expect((await store.saveTeam({ teamId: 'toct', name: ' ', applications: [] })).error).toBeTruthy();
	});

	it('deletes the team with its entries and clears the selection when it was the selected one', async () => {
		await store.saveTeam({ name: 'Other', applications: [{ name: 'Core', testTypeKeys: ['unit'] }] });
		await store.saveEntry(entryOf('apis', 10));
		store.selectTeam('toct');
		await store.removeTeam('toct');

		expect(store.getTeam('toct')).toBeUndefined();
		expect(store.entries().length).toBe(0);
		expect(store.selectedTeamId()).toBe('');
	});
});

describe('CoverageStore when the storage fails', () => {
	class FailingRepository extends InMemoryCoverageRepository {
		fail = false;

		override async load(): ReturnType<InMemoryCoverageRepository['load']> {
			if (this.fail) {
				throw new RepositoryError('Error_Load');
			}
			return super.load();
		}

		override async saveEntries(): Promise<void> {
			throw new RepositoryError('Error_Save');
		}
	}

	let repository: FailingRepository;
	let store: CoverageStore;

	beforeEach(async () => {
		repository = new FailingRepository();
		TestBed.configureTestingModule({ providers: [{ provide: CoverageRepository, useValue: repository }] });
		store = TestBed.inject(CoverageStore);
		await store.loaded;
	});

	it('returns the error key and keeps the data when saving fails', async () => {
		const result = await store.saveEntry(entryOf('apis', 50));
		expect(result.error).toBe('Error_Save');
		expect(store.entries().length).toBe(0);
	});

	it('reports a load failure and stops the loading state', async () => {
		repository.fail = true;
		await store.reload();
		expect(store.loadError()).toBe('Error_Load');
		expect(store.loading()).toBeFalse();
		expect(store.teams().length).toBe(1);
	});
});
