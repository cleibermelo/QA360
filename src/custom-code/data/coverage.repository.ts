import { CoverageEntry, CoverageInput, Team, TeamInput, TestType } from '../domain/models';

/** Everything the app shows, as stored. */
export interface CoverageSnapshot {
	testTypes: TestType[];
	teams: Team[];
	entries: CoverageEntry[];
}

/** Identifies one entry: application, test type and month. */
export type EntryKey = Pick<CoverageInput, 'applicationId' | 'testTypeKey' | 'year' | 'month'>;

/** A storage failure; `key` is the i18n key of the message shown to the user. */
export class RepositoryError extends Error {
	constructor(readonly key: string) {
		super(key);
	}
}

/**
 * Where the data lives. The store depends on this contract only, so the storage can change
 * (Supabase in the app, memory in tests). Methods throw `RepositoryError` on failure.
 */
export abstract class CoverageRepository {
	abstract load(): Promise<CoverageSnapshot>;
	/** Creates or updates the team and its applications; returns the team id. */
	abstract saveTeam(input: TeamInput, existing: Team | undefined): Promise<string>;
	/** Deletes the team with its applications and entries. */
	abstract removeTeam(teamId: string): Promise<void>;
	/** Creates or overwrites the entries (the previous values go to the history), all or none. */
	abstract saveEntries(inputs: CoverageInput[]): Promise<void>;
	abstract removeEntry(key: EntryKey): Promise<void>;
}
