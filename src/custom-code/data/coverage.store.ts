import { computed, inject, Injectable, signal } from '@angular/core';
import { CoverageEntry, CoverageInput, Team, TeamApplication, TeamInput, TestType } from '../domain/models';
import {
	findApplicationOwner,
	findEntry,
	upsertEntry,
	UpsertOutcome,
	validateApplicationName,
	validateApplicationTestTypes,
	validateEntryTestType,
	validatePercent,
	validateTeamApplications,
	validateTeamName
} from '../domain/rules';
import { CoverageRepository, RepositoryError } from './coverage.repository';

/** How many entries of a batch were created, overwritten or left as they were. */
export type EntriesOutcome = Record<UpsertOutcome, number>;

/** Either a value or an error: an i18n key (plus placeholder values) that the UI translates. */
export interface StoreResult<T = void> {
	value?: T;
	error?: string;
	/** For application errors, `index` is the 1-based position of the offending application in the form. */
	errorParams?: Record<string, string | number>;
	/** Values for the placeholders of the error message itself. */
	messageParams?: Record<string, string | number>;
}

/**
 * State of the app: teams, applications and coverage entries, kept in sync with the repository.
 * Writes are validated here, saved through the repository and followed by a reload,
 * so what the screens show is always what is stored.
 */
@Injectable({ providedIn: 'root' })
export class CoverageStore {
	readonly testTypes = signal<TestType[]>([]);
	readonly teams = signal<Team[]>([]);
	readonly entries = signal<CoverageEntry[]>([]);
	/** The team kept selected while the user moves between screens. */
	readonly selectedTeamId = signal<string>('');
	/** True until the first load finishes. */
	readonly loading = signal(true);
	/** i18n key of the last load failure, or null. */
	readonly loadError = signal<string | null>(null);

	/** Inactive test types never show up in the selects. */
	readonly activeTestTypes = computed(() => this.testTypes().filter((t) => t.active));
	readonly selectedTeam = computed(() => this.teams().find((t) => t.id === this.selectedTeamId()));

	/** Resolves when the first load has finished (successfully or not). */
	readonly loaded: Promise<void>;

	private readonly repository = inject(CoverageRepository);

	constructor() {
		this.loaded = this.reload();
	}

	/** Reads everything again from the repository. */
	async reload(): Promise<void> {
		try {
			const snapshot = await this.repository.load();
			this.testTypes.set(snapshot.testTypes);
			this.teams.set(snapshot.teams);
			this.entries.set(snapshot.entries);
			// No team is selected by default: the user picks it. A selection that no longer exists is cleared.
			if (!snapshot.teams.some((t) => t.id === this.selectedTeamId())) {
				this.selectedTeamId.set('');
			}
			this.loadError.set(null);
		} catch (error) {
			this.loadError.set(error instanceof RepositoryError ? error.key : 'Error_Load');
		} finally {
			this.loading.set(false);
		}
	}

	getTeam(teamId: string): Team | undefined {
		return this.teams().find((t) => t.id === teamId);
	}

	getTestType(key: string): TestType | undefined {
		return this.testTypes().find((t) => t.key === key);
	}

	selectTeam(teamId: string): void {
		if (this.getTeam(teamId)) {
			this.selectedTeamId.set(teamId);
		}
	}

	/** Creates or updates a team and its applications at once; removed applications take their entries with them. */
	async saveTeam(input: TeamInput): Promise<StoreResult<Team>> {
		const existing = input.teamId ? this.getTeam(input.teamId) : undefined;
		if (input.teamId && !existing) {
			return { error: 'Validation_TeamNotFound' };
		}
		const teamError =
			validateTeamName(input.name, this.teams(), input.teamId) ?? validateTeamApplications(input.applications);
		if (teamError) {
			return { error: teamError };
		}

		const accepted: TeamApplication[] = [];
		for (const [index, item] of input.applications.entries()) {
			// Names are checked against the ones already accepted, so duplicates inside the form are caught.
			const nameError = validateApplicationName(item.name, accepted, item.id);
			const owner = nameError ? undefined : findApplicationOwner(item.name, this.teams(), input.teamId);
			if (owner) {
				return {
					error: 'Validation_ApplicationInOtherTeam',
					errorParams: { index: index + 1 },
					messageParams: { name: item.name.trim(), team: owner.name }
				};
			}
			const error = nameError ?? validateApplicationTestTypes(item.testTypeKeys);
			if (error) {
				return { error, errorParams: { index: index + 1 } };
			}
			accepted.push({ id: item.id ?? `new-${index}`, name: item.name.trim(), testTypeKeys: item.testTypeKeys });
		}

		try {
			const teamId = await this.repository.saveTeam(input, existing);
			await this.reload();
			return { value: this.getTeam(teamId) };
		} catch (error) {
			// The save has several steps, so something may have been stored before the failure.
			await this.reload();
			return this.failure(error);
		}
	}

	/** Deletes the team with all its entries; the selection moves to another team, if any. */
	async removeTeam(teamId: string): Promise<StoreResult> {
		try {
			await this.repository.removeTeam(teamId);
			await this.reload();
			return {};
		} catch (error) {
			return this.failure(error);
		}
	}

	/** Returns the i18n key of the error, or null when the entry can be saved. */
	validateEntry(input: CoverageInput): string | null {
		const application = this.getTeam(input.teamId)?.applications.find((a) => a.id === input.applicationId);
		return (
			validateEntryTestType(application, input.testTypeKey, this.testTypes()) ?? validatePercent(input.percent)
		);
	}

	findEntry(
		input: Pick<CoverageInput, 'teamId' | 'applicationId' | 'testTypeKey' | 'year' | 'month'>
	): CoverageEntry | undefined {
		return findEntry(this.entries(), input);
	}

	/** Creates the entry, or overwrites it (the previous value goes to the history) when it already exists. */
	async saveEntry(input: CoverageInput): Promise<StoreResult<UpsertOutcome>> {
		const result = await this.saveEntries([input]);
		if (result.error) {
			return { error: result.error };
		}
		const { created, updated } = result.value;
		return { value: created > 0 ? 'created' : updated > 0 ? 'updated' : 'unchanged' };
	}

	/**
	 * Saves several entries at once, all or none. Entries whose value did not change are skipped.
	 * `errorParams.index` is the 1-based position of the offending entry in `inputs`.
	 */
	async saveEntries(inputs: CoverageInput[]): Promise<StoreResult<EntriesOutcome>> {
		const seen = new Set<string>();
		for (const [index, input] of inputs.entries()) {
			const key = `${input.teamId}|${input.applicationId}|${input.testTypeKey}|${input.year}|${input.month}`;
			const error = this.validateEntry(input) ?? (seen.has(key) ? 'Validation_RecordDuplicateRow' : null);
			if (error) {
				return { error, errorParams: { index: index + 1 } };
			}
			seen.add(key);
		}

		const outcome: EntriesOutcome = { created: 0, updated: 0, unchanged: 0 };
		const changed: CoverageInput[] = [];
		for (const input of inputs) {
			const result = upsertEntry(this.entries(), input).outcome;
			outcome[result]++;
			if (result !== 'unchanged') {
				changed.push(input);
			}
		}
		if (changed.length === 0) {
			return { value: outcome };
		}
		try {
			await this.repository.saveEntries(changed);
			await this.reload();
			return { value: outcome };
		} catch (failure) {
			return this.failure(failure);
		}
	}

	async removeEntry(entry: CoverageEntry): Promise<StoreResult> {
		try {
			await this.repository.removeEntry(entry);
			await this.reload();
			return {};
		} catch (error) {
			return this.failure(error);
		}
	}

	private failure(error: unknown): { error: string } {
		return { error: error instanceof RepositoryError ? error.key : 'Error_Save' };
	}
}
